-- GiftLedger: full database setup for a NEW, EMPTY Supabase project.
-- Generated from supabase/migrations/ (in order). Paste into Supabase → SQL Editor → Run, once.

-- ===== supabase/migrations/20261007000000_init.sql =====
-- GiftLedger: initial schema, row-level security and core database actions.
-- Money is stored in whole cents. Security rules live here, not only in the app.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;  -- helper functions; not exposed through the browser API

-- ===== Types =====
create type public.member_role as enum ('owner', 'member');
create type public.gift_status as enum ('idea', 'bought', 'wrapped', 'given');
create type public.age_range   as enum ('baby', 'toddler', 'kid', 'tween', 'teen', 'young_adult', 'adult', 'senior');
create type public.ai_kind     as enum ('initial', 'more_like_this', 'different_direction');
create type public.ai_status   as enum ('pending', 'success', 'failed');

-- ===== Tables =====
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text not null default '' check (char_length(display_name) <= 60),
  time_zone       text not null default 'America/New_York' check (char_length(time_zone) <= 64),
  email_reminders boolean not null default true,
  paid_until      timestamptz,                 -- Season Pass; written only by the Stripe webhook
  onboarded_at    timestamptz,
  created_at      timestamptz not null default now()
);

create table public.lists (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null default 'Holidays 2026' check (char_length(name) between 1 and 60),
  overall_budget_cents integer check (overall_budget_cents between 0 and 100000000),
  created_at           timestamptz not null default now()
);

create table public.list_members (
  list_id   uuid not null references public.lists (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      public.member_role not null,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create unique index list_members_one_owner on public.list_members (list_id) where role = 'owner';
create index list_members_user_idx on public.list_members (user_id);

create table public.invites (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  token_hash text not null unique,             -- sha256 of the random token; the token itself is never stored
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  used_by    uuid references public.profiles (id) on delete set null
);
create index invites_list_idx on public.invites (list_id);

create table public.recipients (
  id             uuid primary key default gen_random_uuid(),
  list_id        uuid not null references public.lists (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  relationship   text not null default '' check (char_length(relationship) <= 40),
  budget_cents   integer check (budget_cents between 0 and 10000000),
  age_range      public.age_range,
  interests      text[] not null default '{}' check (cardinality(interests) <= 20),
  notes          text not null default '' check (char_length(notes) <= 1000),
  dont_buy_notes text not null default '' check (char_length(dont_buy_notes) <= 1000),
  linked_user_id uuid references public.profiles (id) on delete set null,  -- "this person is Alex on the list"
  archived_at    timestamptz,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, list_id)
);
create index recipients_list_idx on public.recipients (list_id);

create table public.gifts (
  id                uuid primary key default gen_random_uuid(),
  list_id           uuid not null,
  recipient_id      uuid not null,
  title             text not null check (char_length(title) between 1 and 120),
  link              text check (link ~* '^https?://' and char_length(link) <= 2000),
  price_cents       integer check (price_cents between 0 and 10000000),   -- per item
  quantity          integer not null default 1 check (quantity between 1 and 99),
  status            public.gift_status not null default 'idea',
  store             text check (char_length(store) <= 80),
  purchase_date     date,
  return_by         date,                      -- a calendar date, no time
  notes             text not null default '' check (char_length(notes) <= 1000),
  bought_by         uuid references public.profiles (id) on delete set null,
  status_changed_by uuid references public.profiles (id) on delete set null,
  status_changed_at timestamptz,
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (recipient_id, list_id) references public.recipients (id, list_id) on delete cascade
);
create index gifts_list_idx      on public.gifts (list_id);
create index gifts_recipient_idx on public.gifts (recipient_id);
create index gifts_return_by_idx on public.gifts (return_by) where status in ('bought', 'wrapped');

create table public.gift_hidden_from (
  gift_id uuid not null references public.gifts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (gift_id, user_id)
);
create index gift_hidden_from_user_idx on public.gift_hidden_from (user_id);

create table public.ai_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles (id) on delete set null,
  list_id       uuid references public.lists (id) on delete set null,
  recipient_id  uuid references public.recipients (id) on delete set null,
  kind          public.ai_kind not null,
  status        public.ai_status not null default 'pending',
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  created_at    timestamptz not null default now()
);
create index ai_requests_list_idx on public.ai_requests (list_id, created_at);
create index ai_requests_user_idx on public.ai_requests (user_id, created_at);

create table public.payments (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references public.profiles (id) on delete set null,
  stripe_session_id        text not null unique,
  stripe_payment_intent_id text unique,
  amount_cents             integer not null,
  currency                 text not null default 'usd',
  status                   text not null check (status in ('paid', 'refunded', 'partially_refunded')),
  paid_at                  timestamptz not null default now(),
  refunded_at              timestamptz
);

create table public.stripe_events (            -- webhook idempotency
  id           text primary key,               -- Stripe event id (evt_...)
  type         text not null,
  processed_at timestamptz not null default now()
);

create table public.reminder_log (             -- cron idempotency: one email per user per local day
  user_id    uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  gift_ids   uuid[] not null,
  status     text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  sent_at    timestamptz,
  primary key (user_id, local_date)
);

-- ===== Helper functions =====
-- These run with elevated rights so security rules can look at other tables without
-- looping back into their own rules or being hidden by them.
create function private.is_list_member(p_list uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.list_members
                 where list_id = p_list and user_id = (select auth.uid()));
$$;

create function private.is_list_owner(p_list uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.list_members
                 where list_id = p_list and user_id = (select auth.uid()) and role = 'owner');
$$;

-- The owner's Season Pass covers the whole list.
create function private.list_has_pass(p_list uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.list_members m join public.profiles p on p.id = m.user_id
                 where m.list_id = p_list and m.role = 'owner' and p.paid_until > now());
$$;

create function private.is_about_me(p_recipient uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.recipients
                 where id = p_recipient and linked_user_id = (select auth.uid()));
$$;

create function private.hidden_from_me(p_gift uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.gift_hidden_from
                 where gift_id = p_gift and user_id = (select auth.uid()));
$$;

create function private.can_see_gift(p_gift uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.gifts g
                 where g.id = p_gift
                   and private.is_list_member(g.list_id)
                   and not private.is_about_me(g.recipient_id)
                   and not private.hidden_from_me(g.id));
$$;

create function private.can_edit_gift(p_gift uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.gifts g
                 where g.id = p_gift and private.can_see_gift(g.id)
                   and (g.created_by = (select auth.uid()) or private.is_list_owner(g.list_id)));
$$;

-- ===== Row-level security =====
alter table public.profiles         enable row level security;
alter table public.lists            enable row level security;
alter table public.list_members     enable row level security;
alter table public.invites          enable row level security;
alter table public.recipients       enable row level security;
alter table public.gifts            enable row level security;
alter table public.gift_hidden_from enable row level security;
alter table public.ai_requests      enable row level security;
alter table public.payments         enable row level security;
alter table public.stripe_events    enable row level security;  -- no policies: server only
alter table public.reminder_log     enable row level security;  -- no policies: server only

create policy "profiles: read own"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "lists: members read"  on public.lists for select to authenticated using (private.is_list_member(id));
create policy "lists: owner updates" on public.lists for update to authenticated
  using (private.is_list_owner(id)) with check (private.is_list_owner(id));

create policy "members: list sees members" on public.list_members for select to authenticated
  using (private.is_list_member(list_id));
create policy "members: owner removes, member leaves" on public.list_members for delete to authenticated
  using (role = 'member' and (private.is_list_owner(list_id) or user_id = (select auth.uid())));

create policy "invites: owner reads"   on public.invites for select to authenticated using (private.is_list_owner(list_id));
create policy "invites: owner creates" on public.invites for insert to authenticated
  with check (private.is_list_owner(list_id) and created_by = (select auth.uid()));
create policy "invites: owner deletes" on public.invites for delete to authenticated using (private.is_list_owner(list_id));

create policy "recipients: members read, never about themselves" on public.recipients for select to authenticated
  using (private.is_list_member(list_id) and linked_user_id is distinct from (select auth.uid()));
create policy "recipients: owner adds" on public.recipients for insert to authenticated
  with check (private.is_list_owner(list_id) and created_by = (select auth.uid()));
create policy "recipients: owner edits" on public.recipients for update to authenticated
  using (private.is_list_owner(list_id) and linked_user_id is distinct from (select auth.uid()))
  with check (private.is_list_owner(list_id));
create policy "recipients: owner deletes" on public.recipients for delete to authenticated
  using (private.is_list_owner(list_id) and linked_user_id is distinct from (select auth.uid()));

create policy "gifts: members read what is not hidden from them" on public.gifts for select to authenticated
  using (private.is_list_member(list_id) and not private.is_about_me(recipient_id) and not private.hidden_from_me(id));
create policy "gifts: members add" on public.gifts for insert to authenticated
  with check (private.is_list_member(list_id) and created_by = (select auth.uid())
              and not private.is_about_me(recipient_id));
create policy "gifts: owner or creator edits" on public.gifts for update to authenticated
  using (private.can_edit_gift(id)) with check (private.is_list_member(list_id));
create policy "gifts: owner or creator deletes" on public.gifts for delete to authenticated
  using (private.can_edit_gift(id));

create policy "hidden: seen only by those who see the gift" on public.gift_hidden_from for select to authenticated
  using (private.can_see_gift(gift_id));
create policy "hidden: owner or creator sets" on public.gift_hidden_from for insert to authenticated
  with check (private.can_edit_gift(gift_id) and user_id <> (select auth.uid()));
create policy "hidden: owner or creator clears" on public.gift_hidden_from for delete to authenticated
  using (private.can_edit_gift(gift_id));

create policy "ai: read own"       on public.ai_requests for select to authenticated using (user_id = (select auth.uid()));
create policy "payments: read own" on public.payments    for select to authenticated using (user_id = (select auth.uid()));

-- ===== Column permissions (a second lock on top of row-level security) =====
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
revoke all on public.stripe_events, public.reminder_log from authenticated;
grant insert on public.recipients, public.gifts, public.gift_hidden_from, public.invites to authenticated;
grant delete on public.recipients, public.gifts, public.gift_hidden_from, public.invites, public.list_members to authenticated;
grant update (display_name, time_zone, email_reminders, onboarded_at) on public.profiles to authenticated;
grant update (name, overall_budget_cents) on public.lists to authenticated;
grant update (name, relationship, budget_cents, age_range, interests, notes, dont_buy_notes,
              linked_user_id, archived_at) on public.recipients to authenticated;
grant update (recipient_id, title, link, price_cents, quantity, status, store,
              purchase_date, return_by, notes, bought_by) on public.gifts to authenticated;
grant usage on schema private to authenticated;

-- ===== Triggers =====
-- New account -> profile + their own list, with them as owner.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_list uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), ''), 60));
  insert into public.lists default values returning id into v_list;
  insert into public.list_members (list_id, user_id, role) values (v_list, new.id, 'owner');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Free lists stop at 5 people. Checked in the database, so no app bug or hand-made request can skip it.
create function private.enforce_recipient_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.lists where id = new.list_id for update;   -- one insert at a time per list
  if not private.list_has_pass(new.list_id)
     and (select count(*) from public.recipients where list_id = new.list_id) >= 5 then
    raise exception 'RECIPIENT_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger recipients_limit before insert on public.recipients
  for each row execute function private.enforce_recipient_limit();

-- Remember who last changed a gift's status and when ("Marked bought by Alex, Nov 14").
create function private.track_gift_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_by := (select auth.uid());
    new.status_changed_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger gifts_status before insert or update on public.gifts
  for each row execute function private.track_gift_status();

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger recipients_touch before update on public.recipients
  for each row execute function private.touch_updated_at();

-- ===== Actions the app calls =====
-- Join a list from an invite link: single use, expires, respects the free 1-member limit.
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_invite public.invites;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into v_invite from public.invites
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   for update;
  if not found or v_invite.used_at is not null or v_invite.expires_at < now() then
    raise exception 'INVITE_INVALID';
  end if;
  if exists (select 1 from public.list_members where list_id = v_invite.list_id and user_id = v_uid) then
    return v_invite.list_id;                    -- already on the list; don't use up the invite
  end if;
  perform 1 from public.lists where id = v_invite.list_id for update;
  if not private.list_has_pass(v_invite.list_id)
     and (select count(*) from public.list_members where list_id = v_invite.list_id and role = 'member') >= 1 then
    raise exception 'MEMBER_LIMIT';
  end if;
  insert into public.list_members (list_id, user_id, role) values (v_invite.list_id, v_uid, 'member');
  update public.invites set used_at = now(), used_by = v_uid where id = v_invite.id;
  return v_invite.list_id;
end $$;

-- One-tap status for anyone who can see the gift; marking Bought records you as the buyer.
create function public.set_gift_status(p_gift uuid, p_status public.gift_status) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_see_gift(p_gift) then raise exception 'NOT_FOUND'; end if;
  update public.gifts
     set status    = p_status,
         bought_by = case when p_status = 'idea' then null
                          else coalesce(bought_by, (select auth.uid())) end
   where id = p_gift;
end $$;

-- Names of the people on a list, without exposing anything else from their profiles.
create function public.list_member_names(p_list uuid)
returns table (user_id uuid, display_name text, role public.member_role)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.display_name, m.role
  from public.list_members m join public.profiles p on p.id = m.user_id
  where m.list_id = p_list and private.is_list_member(p_list);
$$;

revoke execute on function public.accept_invite(text), public.set_gift_status(uuid, public.gift_status),
  public.list_member_names(uuid) from public, anon;
grant execute on function public.accept_invite(text), public.set_gift_status(uuid, public.gift_status),
  public.list_member_names(uuid) to authenticated;

-- ===== supabase/migrations/20261008000000_stage2.sql =====
-- Stage 2: plan status for everyone on a list, purchase date on first "bought", time zone check.

-- Pass status and counts, readable by anyone on the list (members can't read the owner's profile).
create function public.list_plan(p_list uuid)
returns table (has_pass boolean, recipient_count integer, member_count integer)
language sql stable security definer set search_path = '' as $$
  select private.list_has_pass(p_list),
         (select count(*)::int from public.recipients where list_id = p_list),
         (select count(*)::int from public.list_members where list_id = p_list and role = 'member')
  where private.is_list_member(p_list);
$$;
revoke execute on function public.list_plan(uuid) from public, anon;
grant execute on function public.list_plan(uuid) to authenticated;

-- Marking a gift bought for the first time also records today's date in the person's time zone.
create or replace function public.set_gift_status(p_gift uuid, p_status public.gift_status) returns void
language plpgsql security definer set search_path = '' as $$
declare v_today date;
begin
  if not private.can_see_gift(p_gift) then raise exception 'NOT_FOUND'; end if;
  select (now() at time zone p.time_zone)::date into v_today
    from public.profiles p where p.id = (select auth.uid());
  update public.gifts
     set status        = p_status,
         bought_by     = case when p_status = 'idea' then null
                              else coalesce(bought_by, (select auth.uid())) end,
         purchase_date = case when p_status = 'idea' then purchase_date
                              else coalesce(purchase_date, v_today, current_date) end
   where id = p_gift;
end $$;

-- Only real time zone names (e.g. America/Chicago) are accepted.
create function private.check_time_zone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'INVALID_TIME_ZONE' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger profiles_time_zone before insert or update of time_zone on public.profiles
  for each row execute function private.check_time_zone();

-- ===== supabase/migrations/20261009000000_stage3_ai.sql =====
-- Stage 3: AI request limits. Free lists get 10 successful requests, lists with a Season Pass 100.
-- Each person can make at most 10 requests a minute. Failed requests don't count.

create function private.ai_cap(p_list uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when private.list_has_pass(p_list) then 100 else 10 end;
$$;

-- Called by the server (service role) before contacting the AI. Reserves one request or
-- raises AI_RATE_LIMIT / AI_LIMIT. Pending requests count for 2 minutes, so a burst of
-- parallel requests can't go past the cap.
create function public.reserve_ai_request(p_user uuid, p_list uuid, p_recipient uuid, p_kind public.ai_kind)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.list_members where list_id = p_list and user_id = p_user) then
    raise exception 'NOT_A_MEMBER';
  end if;
  perform 1 from public.lists where id = p_list for update;  -- one reservation at a time per list
  if (select count(*) from public.ai_requests
      where user_id = p_user and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'AI_RATE_LIMIT';
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

-- Called by the server when the AI call finishes. Only a pending request can be finished.
create function public.finish_ai_request(p_id uuid, p_success boolean, p_input_tokens integer, p_output_tokens integer)
returns void
language sql security definer set search_path = '' as $$
  update public.ai_requests
     set status = case when p_success then 'success'::public.ai_status else 'failed'::public.ai_status end,
         input_tokens = greatest(p_input_tokens, 0),
         output_tokens = greatest(p_output_tokens, 0)
   where id = p_id and status = 'pending';
$$;

revoke execute on function public.reserve_ai_request(uuid, uuid, uuid, public.ai_kind) from public, anon, authenticated;
revoke execute on function public.finish_ai_request(uuid, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid, uuid, uuid, public.ai_kind) to service_role;
grant execute on function public.finish_ai_request(uuid, boolean, integer, integer) to service_role;

-- How many requests the list has used and its cap, for anyone on the list.
create function public.ai_usage(p_list uuid) returns table (used integer, cap integer)
language sql stable security definer set search_path = '' as $$
  select (select count(*)::int from public.ai_requests where list_id = p_list and status = 'success'),
         private.ai_cap(p_list)
  where private.is_list_member(p_list);
$$;
revoke execute on function public.ai_usage(uuid) from public, anon;
grant execute on function public.ai_usage(uuid) to authenticated;

-- ===== supabase/migrations/20261010000000_stage4_sharing.sql =====
-- Stage 4: family sharing helpers.

-- Invite tokens are stored only as a sha256 fingerprint.
alter table public.invites add constraint invites_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$');

-- At most 10 invites per person per hour, enforced for every way of creating one.
create function private.limit_invites() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.invites
      where created_by = new.created_by and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'INVITE_RATE_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger invites_rate_limit before insert on public.invites
  for each row execute function private.limit_invites();

-- What the join page shows: the list's name, who invited you, and whether the link still works.
create function public.invite_preview(p_token text)
returns table (list_name text, invited_by text, status text)
language sql stable security definer set search_path = '' as $$
  select l.name,
         p.display_name,
         case when i.used_at is not null then 'used'
              when i.expires_at < now() then 'expired'
              else 'valid' end
  from public.invites i
  join public.lists l on l.id = i.list_id
  join public.profiles p on p.id = i.created_by
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and (select auth.uid()) is not null;
$$;
revoke execute on function public.invite_preview(text) from public, anon;
grant execute on function public.invite_preview(text) to authenticated;

-- A linked person must be someone on the same list.
create function private.check_linked_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.linked_user_id is not null and not exists (
    select 1 from public.list_members where list_id = new.list_id and user_id = new.linked_user_id
  ) then
    raise exception 'LINKED_USER_NOT_MEMBER' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger recipients_linked_user before insert or update of linked_user_id on public.recipients
  for each row execute function private.check_linked_user();

-- Only people on the list can be hidden from a gift, or recorded as its buyer.
create function private.check_gift_people() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.bought_by is not null and not exists (
    select 1 from public.list_members where list_id = new.list_id and user_id = new.bought_by
  ) then
    raise exception 'BUYER_NOT_MEMBER' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger gifts_people before insert or update of bought_by on public.gifts
  for each row execute function private.check_gift_people();

-- ===== supabase/migrations/20261011000000_stage5_payments.sql =====
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

-- ===== supabase/migrations/20261012000000_stage6_reminders.sql =====
-- Stage 6: daily return reminders. Only the scheduled job (server, service role) calls these.

-- Everything due today for each person, in their own time zone:
--   * gifts that are Bought or Wrapped, with a return-by date 3 days from now or today,
--   * on a list that has a Season Pass,
--   * sent to whoever marked it bought (or the list owner if nobody did),
--   * only if that person can see the gift and hasn't turned reminders off.
create function public.due_reminders(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  display_name text,
  local_date date,
  gift_id uuid,
  gift_title text,
  recipient_name text,
  store text,
  return_by date,
  days_left integer
)
language sql stable security definer set search_path = '' as $$
  with candidates as (
    select g.id as gift_id, g.title, g.store, g.return_by, g.recipient_id, g.list_id,
           coalesce(g.bought_by,
                    (select m.user_id from public.list_members m where m.list_id = g.list_id and m.role = 'owner')) as user_id
    from public.gifts g
    where g.status in ('bought', 'wrapped')
      and g.return_by is not null
      and g.return_by between (p_now at time zone 'UTC')::date - 1 and (p_now at time zone 'UTC')::date + 4
      and private.list_has_pass(g.list_id)
  )
  select c.user_id, u.email::text, p.display_name, (p_now at time zone p.time_zone)::date,
         c.gift_id, c.title, r.name, c.store, c.return_by,
         c.return_by - (p_now at time zone p.time_zone)::date
  from candidates c
  join public.profiles p on p.id = c.user_id
  join auth.users u on u.id = c.user_id
  join public.recipients r on r.id = c.recipient_id
  join public.list_members lm on lm.list_id = c.list_id and lm.user_id = c.user_id
  where p.email_reminders
    and c.return_by - (p_now at time zone p.time_zone)::date in (0, 3)
    and r.linked_user_id is distinct from c.user_id
    and not exists (select 1 from public.gift_hidden_from h where h.gift_id = c.gift_id and h.user_id = c.user_id)
  order by c.user_id, c.return_by, c.title;
$$;

-- Claims today's email for a person. Returns false if it was already sent (or is being sent),
-- so running the job twice in one day sends nothing extra. A failed send can be retried.
create function public.claim_reminder(p_user uuid, p_local_date date, p_gift_ids uuid[])
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.reminder_log (user_id, local_date, gift_ids, status)
  values (p_user, p_local_date, p_gift_ids, 'sending')
  on conflict (user_id, local_date) do update
     set status = 'sending', gift_ids = excluded.gift_ids
   where public.reminder_log.status = 'failed';
  return found;
end $$;

create function public.finish_reminder(p_user uuid, p_local_date date, p_sent boolean)
returns void
language sql security definer set search_path = '' as $$
  update public.reminder_log
     set status = case when p_sent then 'sent' else 'failed' end,
         sent_at = case when p_sent then now() else null end
   where user_id = p_user and local_date = p_local_date;
$$;

-- AI spending so far this month, for the cost warning.
create function public.ai_tokens_this_month(p_now timestamptz default now())
returns table (input_tokens bigint, output_tokens bigint)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(input_tokens), 0), coalesce(sum(output_tokens), 0)
  from public.ai_requests
  where created_at >= date_trunc('month', p_now);
$$;

revoke execute on function public.due_reminders(timestamptz) from public, anon, authenticated;
revoke execute on function public.claim_reminder(uuid, date, uuid[]) from public, anon, authenticated;
revoke execute on function public.finish_reminder(uuid, date, boolean) from public, anon, authenticated;
revoke execute on function public.ai_tokens_this_month(timestamptz) from public, anon, authenticated;
grant execute on function public.due_reminders(timestamptz) to service_role;
grant execute on function public.claim_reminder(uuid, date, uuid[]) to service_role;
grant execute on function public.finish_reminder(uuid, date, boolean) to service_role;
grant execute on function public.ai_tokens_this_month(timestamptz) to service_role;

-- ===== supabase/migrations/20261013000000_stage7_account.sql =====
-- Stage 7: account deletion. When an owner deletes their account, each shared list they own
-- passes to a member they choose. Only the server (service role) calls this, after checking
-- who is asking.
create function public.transfer_list_ownership(p_list uuid, p_from uuid, p_to uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.list_members where list_id = p_list and user_id = p_from and role = 'owner') then
    raise exception 'NOT_OWNER';
  end if;
  if not exists (select 1 from public.list_members where list_id = p_list and user_id = p_to and role = 'member') then
    raise exception 'NOT_A_MEMBER';
  end if;
  -- One owner per list: step down first, then hand over.
  update public.list_members set role = 'member' where list_id = p_list and user_id = p_from;
  update public.list_members set role = 'owner' where list_id = p_list and user_id = p_to;
end $$;

revoke execute on function public.transfer_list_ownership(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_list_ownership(uuid, uuid, uuid) to service_role;

-- ===== supabase/migrations/20261014000000_security_review_1.sql =====
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

-- ===== supabase/migrations/20261015000000_security_review_2.sql =====
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
