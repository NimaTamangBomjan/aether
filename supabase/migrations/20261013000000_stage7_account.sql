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
