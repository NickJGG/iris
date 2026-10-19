-- When the recipient watched each Share. Not a column on shares: senders can read their Shares'
-- rows, and Iris has no read receipts.

create table public.share_watches (
  share_id uuid primary key references public.shares on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  watched_at timestamptz not null default now()
);

alter table public.share_watches enable row level security;

-- No write policies: rows are only created by mark_watched.
create policy share_watches_select on public.share_watches
  for select to authenticated using (user_id = auth.uid());

insert into public.share_watches (share_id, user_id, watched_at)
select id, recipient_id, watched_at from public.shares where watched_at is not null;

drop policy shares_insert on public.shares;
create policy shares_insert on public.shares
  for insert to authenticated
  with check (sender_id = auth.uid() and public.are_friends(sender_id, recipient_id));

alter table public.shares drop column watched_at;

create or replace function public.mark_watched(vid text) returns integer
language sql security definer set search_path = '' as $$
  with marked as (
    insert into public.share_watches (share_id, user_id)
    select s.id, s.recipient_id from public.shares s
    where s.recipient_id = auth.uid() and s.video_id = vid
      and not exists (select 1 from public.share_watches w where w.share_id = s.id)
    returning 1
  )
  select count(*)::int from marked;
$$;
