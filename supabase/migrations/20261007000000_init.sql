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
