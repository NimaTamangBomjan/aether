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
