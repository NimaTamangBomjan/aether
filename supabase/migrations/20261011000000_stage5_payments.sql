-- Stage 5: payments. Only the Stripe webhook (server, service role) calls these.
-- Each Stripe event is applied at most once, so Stripe retrying an event is safe.

-- The Season Pass runs through Jan 31, 2027 (end of the day, US Eastern time).
create function private.season_pass_end() returns timestamptz
language sql immutable as $$ select timestamptz '2027-02-01 05:00:00+00' $$;

create function public.record_checkout_paid(
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
begin
  insert into public.stripe_events (id, type) values (p_event_id, 'checkout.session.completed')
  on conflict (id) do nothing;
  if not found then
    return false;  -- already handled
  end if;

  select id into v_user from public.profiles where id = p_user;  -- null if the account was deleted
  insert into public.payments (user_id, stripe_session_id, stripe_payment_intent_id, amount_cents, currency, status)
  values (v_user, p_session_id, p_payment_intent, p_amount, lower(p_currency), 'paid')
  on conflict (stripe_session_id) do nothing;

  if v_user is not null then
    update public.profiles
       set paid_until = greatest(coalesce(paid_until, '-infinity'::timestamptz), private.season_pass_end())
     where id = v_user;
  end if;
  return true;
end $$;

create function public.record_charge_refunded(
  p_event_id text,
  p_payment_intent text,
  p_amount_refunded integer,
  p_amount integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_full boolean := p_amount_refunded >= p_amount;
begin
  insert into public.stripe_events (id, type) values (p_event_id, 'charge.refunded')
  on conflict (id) do nothing;
  if not found then
    return false;
  end if;

  update public.payments
     set status = case when v_full then 'refunded' else 'partially_refunded' end,
         refunded_at = now()
   where stripe_payment_intent_id = p_payment_intent
  returning user_id into v_user;

  -- A full refund removes the pass, unless the person has another paid payment.
  if v_full and v_user is not null and not exists (
    select 1 from public.payments where user_id = v_user and status in ('paid', 'partially_refunded')
  ) then
    update public.profiles set paid_until = null where id = v_user;
  end if;
  return true;
end $$;

revoke execute on function public.record_checkout_paid(text, text, text, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.record_charge_refunded(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.record_checkout_paid(text, text, text, uuid, integer, text) to service_role;
grant execute on function public.record_charge_refunded(text, text, integer, integer) to service_role;
