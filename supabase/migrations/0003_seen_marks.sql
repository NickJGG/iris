-- When each User last viewed their Inbox and Friends tabs, so the guide dot shows only what's new.
-- Not on profiles: Friends can read those rows and would learn when you last opened Iris.

create table public.seen_marks (
  user_id uuid primary key references auth.users on delete cascade,
  shares_seen_at timestamptz,
  requests_seen_at timestamptz
);

alter table public.seen_marks enable row level security;

create policy seen_marks_select on public.seen_marks
  for select to authenticated using (user_id = auth.uid());

-- Any other kind is a no-op.
create function public.mark_seen(kind text) returns void
language sql security definer set search_path = '' as $$
  insert into public.seen_marks as m (user_id, shares_seen_at, requests_seen_at)
  select auth.uid(),
    case when kind = 'shares' then now() end,
    case when kind = 'requests' then now() end
  where kind in ('shares', 'requests')
  on conflict (user_id) do update set
    shares_seen_at = coalesce(excluded.shares_seen_at, m.shares_seen_at),
    requests_seen_at = coalesce(excluded.requests_seen_at, m.requests_seen_at);
$$;

revoke execute on function public.mark_seen(text) from public, anon;
grant execute on function public.mark_seen(text) to authenticated;
