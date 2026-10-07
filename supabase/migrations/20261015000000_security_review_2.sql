-- Fixes from security review #2 (see PROGRESS.md).

-- ===== M1: passwords can't be set, and email addresses can't be changed =====
-- GiftLedger has no passwords (emailed codes and Google only), but Supabase's "update user"
-- endpoint lets any signed-in session set one. Someone with a few minutes in a family member's
-- browser could set a password and keep reading their list for good. So any newly set password
-- is replaced with random bytes nobody knows, every time.
create function private.scramble_new_password() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and coalesce(new.encrypted_password, '') <> '' then
    new.encrypted_password := extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf'));
  end if;
  return new;
end $$;
create trigger scramble_new_password before update of encrypted_password on auth.users
  for each row execute function private.scramble_new_password();

-- The app has no "change my email" feature. Changing an account's email to someone else's
-- address would hand that person's future sign-ins to the account's creator, so it's refused.
create function private.refuse_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.email_change, '') <> '' and new.email_change is distinct from old.email_change then
    raise exception 'EMAIL_CHANGE_DISABLED' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger refuse_email_change before update of email_change on auth.users
  for each row execute function private.refuse_email_change();

-- ===== L2: names and titles are one line of plain text =====
-- They go into email subjects, so line breaks and other control characters are refused.
create function private.single_line(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p is null or p !~ '[\u0001-\u001f\u007f-\u009f  ]';
$$;
alter table public.gifts add constraint gifts_title_single_line check (private.single_line(title));
alter table public.gifts add constraint gifts_store_single_line check (private.single_line(store));
alter table public.recipients add constraint recipients_name_single_line check (private.single_line(name));
alter table public.profiles add constraint profiles_display_name_single_line check (private.single_line(display_name));
alter table public.lists add constraint lists_name_single_line check (private.single_line(name));

-- ===== L5: the name family members see is never chosen by whoever typed an email address =====
-- Anyone can start a sign-in for any address and attach a "full name" to it, so the name is
-- only taken from Google (which checked it). Everyone else starts with the part before the @.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_list uuid;
  v_name text;
begin
  if new.raw_app_meta_data ->> 'provider' = 'google' then
    v_name := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  end if;
  v_name := coalesce(v_name, split_part(new.email, '@', 1), '');
  v_name := left(regexp_replace(v_name, '[\u0001-\u001f\u007f-\u009f  ]+', ' ', 'g'), 60);
  insert into public.profiles (id, display_name) values (new.id, v_name);
  insert into public.lists default values returning id into v_list;
  insert into public.list_members (list_id, user_id, role) values (v_list, new.id, 'owner');
  return new;
end $$;

-- ===== L3: a payment that arrives after a refund always belongs to its buyer =====
-- If any refund was recorded first (full or partial), the payment is attached to that row, so a
-- later full refund knows whose pass to remove.
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

  select status into v_status from public.payments where stripe_payment_intent_id = p_payment_intent;
  if found then
    update public.payments
       set stripe_session_id = p_session_id,
           user_id = coalesce(user_id, v_user)
     where stripe_payment_intent_id = p_payment_intent;
    -- Fully refunded already: the record is complete, but no pass.
    if v_status = 'refunded' then
      return true;
    end if;
  else
    insert into public.payments (user_id, stripe_session_id, stripe_payment_intent_id, amount_cents, currency, status)
    values (v_user, p_session_id, p_payment_intent, p_amount, lower(p_currency), 'paid')
    on conflict do nothing;
  end if;

  if v_user is not null then
    update public.profiles
       set paid_until = greatest(coalesce(paid_until, '-infinity'::timestamptz), private.season_pass_end())
     where id = v_user;
  end if;
  return true;
end $$;

-- ===== L4: a deleted account leaves nothing personal behind in the sign-in logs =====
create function private.purge_auth_logs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.audit_log_entries
   where payload ->> 'actor_id' = old.id::text
      or payload -> 'traits' ->> 'user_id' = old.id::text
      or (old.email is not null
          and (payload ->> 'actor_username' = old.email or payload -> 'traits' ->> 'user_email' = old.email));
  return null;
end $$;
create trigger purge_auth_logs after delete on auth.users
  for each row execute function private.purge_auth_logs();

-- ===== M4: emailed invites can't be used to send spam =====
-- Remembers which addresses were emailed (as a one-way hash, never the address itself), so:
-- - one account can email 3 invites a day (10 with the Season Pass);
-- - nobody can email the same address twice within a day, and one account can't within 30 days;
-- - all invite emails pause at 500 a day across the whole app, until the next day.
create table public.invite_emails (
  id bigint generated always as identity primary key,
  created_by uuid references public.profiles (id) on delete set null,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index invite_emails_hash_idx on public.invite_emails (email_hash, created_at);
create index invite_emails_created_by_idx on public.invite_emails (created_by, created_at);
create index invite_emails_created_at_idx on public.invite_emails (created_at);
alter table public.invite_emails enable row level security;
-- No policies: only the server uses this table, through the function below.
revoke all on public.invite_emails from anon, authenticated;

create function public.reserve_invite_email(p_user uuid, p_email_hash text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pass boolean;
  v_daily integer := 3;
begin
  -- One at a time, so the counts below are exact.
  perform pg_advisory_xact_lock(hashtext('public.invite_emails'));
  if exists (
    select 1 from public.invite_emails
     where email_hash = p_email_hash
       and (created_at > now() - interval '24 hours'
            or (created_by = p_user and created_at > now() - interval '30 days'))
  ) then
    raise exception 'INVITE_EMAIL_DUPLICATE' using errcode = 'P0001';
  end if;
  select coalesce(paid_until > now(), false) into v_pass from public.profiles where id = p_user;
  if v_pass then
    v_daily := 10;
  end if;
  if (select count(*) from public.invite_emails
      where created_by = p_user and created_at > now() - interval '24 hours') >= v_daily then
    raise exception 'INVITE_EMAIL_LIMIT' using errcode = 'P0001';
  end if;
  if (select count(*) from public.invite_emails where created_at > now() - interval '24 hours') >= 500 then
    raise exception 'INVITE_EMAIL_PAUSED' using errcode = 'P0001';
  end if;
  insert into public.invite_emails (created_by, email_hash) values (p_user, p_email_hash);
end $$;
revoke execute on function public.reserve_invite_email(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_invite_email(uuid, text) to service_role;

-- ===== M5: daily tidy-up =====
-- Run by the daily job:
-- - removes sign-ups nobody finished within a day (codes requested for addresses whose owner
--   never signed in), with the empty list each one created;
-- - keeps sign-in logs for 30 days only;
-- - keeps the invite-email records for 30 days only.
create function public.daily_cleanup(p_now timestamptz default now())
returns table (unconfirmed_users integer, auth_log_rows integer, invite_email_rows integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_users integer;
  v_logs integer;
  v_invites integer;
begin
  delete from auth.users
   where email_confirmed_at is null
     and last_sign_in_at is null
     and created_at < p_now - interval '24 hours';
  get diagnostics v_users = row_count;
  delete from auth.audit_log_entries where created_at < p_now - interval '30 days';
  get diagnostics v_logs = row_count;
  delete from public.invite_emails where created_at < p_now - interval '30 days';
  get diagnostics v_invites = row_count;
  return query select v_users, v_logs, v_invites;
end $$;
revoke execute on function public.daily_cleanup(timestamptz) from public, anon, authenticated;
grant execute on function public.daily_cleanup(timestamptz) to service_role;

grant execute on function private.single_line(text) to authenticated, service_role;
