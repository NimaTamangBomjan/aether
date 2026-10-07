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
