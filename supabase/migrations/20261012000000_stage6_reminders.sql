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
