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
