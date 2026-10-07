-- Fixes from security review #1 (see PROGRESS.md).

-- ===== H1: a password set by someone else never survives =====
-- GiftLedger signs people in with emailed codes and Google only, but Supabase's password
-- sign-up endpoint is public. Someone could pre-register another person's email with a
-- password and wait for them to confirm it. So the moment an email address is confirmed
-- (by its real owner signing in), any password on the account is replaced with a random one.
-- Production must keep "Confirm email" switched on (it is by default).
create function private.scramble_password_on_confirm() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    new.encrypted_password := extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf'));
  end if;
  return new;
end $$;
create trigger scramble_password_on_confirm before insert or update of email_confirmed_at on auth.users
  for each row execute function private.scramble_password_on_confirm();

-- ===== H2: keep AI prompts small and AI attempts limited =====
create function private.interests_valid(p_interests text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(bool_and(char_length(i) between 1 and 30), true) from unnest(p_interests) as i;
$$;
alter table public.recipients add constraint recipients_interest_length check (private.interests_valid(interests));

-- Failed answers stay free for people, but nobody can retry endlessly: at most 30 attempts per
-- person and 60 per list in any 24 hours, whatever the outcome.
create or replace function public.reserve_ai_request(p_user uuid, p_list uuid, p_recipient uuid, p_kind public.ai_kind)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.list_members where list_id = p_list and user_id = p_user) then
    raise exception 'NOT_A_MEMBER';
  end if;
  perform 1 from public.lists where id = p_list for update;
  if (select count(*) from public.ai_requests
      where user_id = p_user and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'AI_RATE_LIMIT';
  end if;
  if (select count(*) from public.ai_requests
      where user_id = p_user and created_at > now() - interval '24 hours') >= 30
     or (select count(*) from public.ai_requests
         where list_id = p_list and created_at > now() - interval '24 hours') >= 60 then
    raise exception 'AI_DAILY_LIMIT';
  end if;
  if (select count(*) from public.ai_requests
      where list_id = p_list
        and (status = 'success' or (status = 'pending' and created_at > now() - interval '2 minutes')))
     >= private.ai_cap(p_list) then
    raise exception 'AI_LIMIT';
  end if;
  insert into public.ai_requests (user_id, list_id, recipient_id, kind)
  values (p_user, p_list, p_recipient, p_kind)
  returning id into v_id;
  return v_id;
end $$;

-- ===== L1: members can't count people hidden from them =====
create or replace function public.list_plan(p_list uuid)
returns table (has_pass boolean, recipient_count integer, member_count integer)
language sql stable security definer set search_path = '' as $$
  select private.list_has_pass(p_list),
         (select count(*)::int from public.recipients r
           where r.list_id = p_list
             and (private.is_list_owner(p_list) or r.linked_user_id is distinct from (select auth.uid()))),
         (select count(*)::int from public.list_members where list_id = p_list and role = 'member')
  where private.is_list_member(p_list);
$$;

-- ===== L2: people can only write the columns they're meant to =====
revoke insert on public.invites, public.recipients, public.gifts, public.gift_hidden_from from authenticated;
grant insert (list_id, token_hash, created_by) on public.invites to authenticated;
grant insert (list_id, name, relationship, budget_cents, age_range, interests, notes, dont_buy_notes,
              linked_user_id, archived_at, created_by) on public.recipients to authenticated;
grant insert (list_id, recipient_id, title, link, price_cents, quantity, status, store,
              purchase_date, return_by, notes, bought_by, created_by) on public.gifts to authenticated;
grant insert (gift_id, user_id) on public.gift_hidden_from to authenticated;

-- Invites always start now and last exactly 7 days, however they're created.
create or replace function private.limit_invites() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.invites
      where created_by = new.created_by and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'INVITE_RATE_LIMIT' using errcode = 'P0001';
  end if;
  if (select auth.uid()) is not null then
    new.created_at := now();
    new.expires_at := now() + interval '7 days';
    new.used_at := null;
    new.used_by := null;
  end if;
  return new;
end $$;

-- ===== L3: only people on the list can be hidden from a gift =====
create function private.check_hidden_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.gifts g join public.list_members m on m.list_id = g.list_id
    where g.id = new.gift_id and m.user_id = new.user_id
  ) then
    raise exception 'HIDDEN_USER_NOT_MEMBER' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger gift_hidden_from_member before insert or update on public.gift_hidden_from
  for each row execute function private.check_hidden_member();

-- ===== L4: members can only record themselves as the buyer =====
create or replace function private.check_gift_people() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.bought_by is not null and not exists (
    select 1 from public.list_members where list_id = new.list_id and user_id = new.bought_by
  ) then
    raise exception 'BUYER_NOT_MEMBER' using errcode = 'P0001';
  end if;
  if (select auth.uid()) is not null
     and new.bought_by is not null
     and new.bought_by is distinct from (select auth.uid())
     and (tg_op = 'INSERT' or new.bought_by is distinct from old.bought_by)
     and not private.is_list_owner(new.list_id) then
    raise exception 'BUYER_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ===== L5: refunds that arrive before the payment, and payments after a refund =====
create or replace function public.record_checkout_paid(
  p_event_id text,
  p_session_id text,
  p_payment_intent text,
  p_user uuid,
  p_amount integer,
  p_currency text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_status text;
begin
  insert into public.stripe_events (id, type) values (p_event_id, 'checkout.session.completed')
  on conflict (id) do nothing;
  if not found then
    return false;
  end if;

  select id into v_user from public.profiles where id = p_user;

  -- Already refunded (the refund event got here first): record it, but don't grant a pass.
  select status into v_status from public.payments where stripe_payment_intent_id = p_payment_intent;
  if v_status = 'refunded' then
    update public.payments set stripe_session_id = p_session_id, user_id = v_user
     where stripe_payment_intent_id = p_payment_intent;
    return true;
  end if;

  insert into public.payments (user_id, stripe_session_id, stripe_payment_intent_id, amount_cents, currency, status)
  values (v_user, p_session_id, p_payment_intent, p_amount, lower(p_currency), 'paid')
  on conflict do nothing;

  if v_user is not null then
    update public.profiles
       set paid_until = greatest(coalesce(paid_until, '-infinity'::timestamptz), private.season_pass_end())
     where id = v_user;
  end if;
  return true;
end $$;

create or replace function public.record_charge_refunded(
  p_event_id text,
  p_payment_intent text,
  p_amount_refunded integer,
  p_amount integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_full boolean := p_amount_refunded >= p_amount;
  v_status text := case when p_amount_refunded >= p_amount then 'refunded' else 'partially_refunded' end;
begin
  insert into public.stripe_events (id, type) values (p_event_id, 'charge.refunded')
  on conflict (id) do nothing;
  if not found then
    return false;
  end if;

  update public.payments set status = v_status, refunded_at = now()
   where stripe_payment_intent_id = p_payment_intent
  returning user_id into v_user;

  if not found then
    -- The refund arrived before the payment event: remember it so the payment won't grant a pass.
    insert into public.payments (user_id, stripe_session_id, stripe_payment_intent_id, amount_cents, currency, status, refunded_at)
    values (null, 'refund-first:' || p_payment_intent, p_payment_intent, p_amount, 'usd', v_status, now());
    return true;
  end if;

  if v_full and v_user is not null and not exists (
    select 1 from public.payments where user_id = v_user and status in ('paid', 'partially_refunded')
  ) then
    update public.profiles set paid_until = null where id = v_user;
  end if;
  return true;
end $$;

-- ===== L6: closed by default =====
revoke execute on all functions in schema private from public;
grant execute on function
  private.is_list_member(uuid), private.is_list_owner(uuid), private.list_has_pass(uuid),
  private.is_about_me(uuid), private.hidden_from_me(uuid), private.can_see_gift(uuid),
  private.can_edit_gift(uuid), private.interests_valid(text[])
  to authenticated, service_role;
-- Anything added later starts with no access until a migration grants it on purpose.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema private revoke execute on functions from public;

-- ===== L9: no orphaned lists =====
-- If someone's account is removed outside the app, their list passes to the earliest member,
-- or is deleted (with its people and gifts) when nobody is left.
create function private.after_member_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_next uuid;
begin
  if not exists (select 1 from public.lists where id = old.list_id) then
    return null;
  end if;
  if old.role = 'owner' and not exists (
    select 1 from public.list_members where list_id = old.list_id and role = 'owner'
  ) then
    select user_id into v_next from public.list_members where list_id = old.list_id order by joined_at limit 1;
    if v_next is null then
      delete from public.lists where id = old.list_id;
    else
      update public.list_members set role = 'owner' where list_id = old.list_id and user_id = v_next;
    end if;
  end if;
  return null;
end $$;
create trigger list_members_after_delete after delete on public.list_members
  for each row execute function private.after_member_removed();
