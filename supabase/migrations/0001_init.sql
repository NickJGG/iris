-- Iris schema, RLS and RPCs.
-- The anon key ships inside the extension, so every table is RLS-locked and anything that
-- touches another User's rows goes through a security definer function keyed on auth.uid().

-- Tables ---------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles on delete cascade,
  to_id uuid not null references public.profiles on delete cascade,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);
create index friend_requests_to_id on public.friend_requests (to_id);

create table public.friendships (
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_user_b on public.friendships (user_b);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.profiles on delete cascade,
  recipient_id uuid not null references public.profiles on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text,
  channel text,
  start_seconds int check (start_seconds >= 0),
  note varchar(140),
  created_at timestamptz not null default now(),
  watched_at timestamptz,
  unique (sender_id, recipient_id, video_id)
);
create index shares_recipient on public.shares (recipient_id, created_at desc);
create index shares_sender on public.shares (sender_id, created_at desc);

-- Profiles are created on sign-up from the Google identity; the handle is claimed on first run.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers --------------------------------------------------------------------------------------
-- Both refuse to answer about pairs the caller isn't part of, so they can't be used as oracles.

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() in (a, b) and exists (
    select 1 from public.friendships where user_a = least(a, b) and user_b = greatest(a, b)
  );
$$;

-- Friends, request counterparties, and anyone you've exchanged Shares with (so cards still
-- show who sent them after a friend is removed).
create function public.can_see_profile(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select other = auth.uid()
    or public.are_friends(auth.uid(), other)
    or exists (
      select 1 from public.friend_requests
      where (from_id = auth.uid() and to_id = other) or (from_id = other and to_id = auth.uid())
    )
    or exists (
      select 1 from public.shares
      where (sender_id = auth.uid() and recipient_id = other) or (sender_id = other and recipient_id = auth.uid())
    );
$$;

-- RLS ------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.shares enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (public.can_see_profile(id));

-- Senders read their requests only through outgoing_requests(), which hides declined_at.
create policy friend_requests_select_incoming on public.friend_requests
  for select to authenticated using (to_id = auth.uid() and declined_at is null);

create policy friendships_select on public.friendships
  for select to authenticated using (auth.uid() in (user_a, user_b));

create policy shares_select on public.shares
  for select to authenticated using (auth.uid() in (sender_id, recipient_id));

create policy shares_insert on public.shares
  for insert to authenticated
  with check (sender_id = auth.uid() and watched_at is null and public.are_friends(sender_id, recipient_id));

create policy shares_delete on public.shares
  for delete to authenticated using (sender_id = auth.uid());

-- RPCs -----------------------------------------------------------------------------------------

create function public.handle_available(h text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(h) ~ '^[a-z0-9_]{3,20}$'
    and not exists (select 1 from public.profiles where handle = lower(h) and id <> auth.uid());
$$;

create function public.claim_handle(h text) returns setof public.profiles
language sql security definer set search_path = '' as $$
  insert into public.profiles (id, handle) values (auth.uid(), lower(h))
  on conflict (id) do update set handle = excluded.handle
  returning *;
$$;

create function public.find_user_by_handle(h text)
returns table (id uuid, handle text, display_name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, p.display_name, p.avatar_url
  from public.profiles p
  where p.handle = lower(h);
$$;

-- Idempotent and silent: re-requesting someone who declined just leaves it pending. If they had
-- already asked you, this accepts their request instead.
create function public.send_friend_request(target_handle text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  target uuid;
  reverse_id uuid;
  request_id uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select id into target from public.profiles where handle = lower(target_handle);
  if target is null then raise exception 'no user with that handle' using errcode = 'P0002'; end if;
  if target = me then raise exception 'cannot friend yourself'; end if;
  if public.are_friends(me, target) then raise exception 'already friends'; end if;

  select id into reverse_id from public.friend_requests where from_id = target and to_id = me;
  if reverse_id is not null then
    perform public.accept_request(reverse_id);
    return reverse_id;
  end if;

  insert into public.friend_requests (from_id, to_id) values (me, target)
  on conflict (from_id, to_id) do update set from_id = excluded.from_id
  returning id into request_id;
  return request_id;
end $$;

create function public.accept_request(request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  requester uuid;
begin
  delete from public.friend_requests where id = request_id and to_id = me
  returning from_id into requester;
  if requester is null then raise exception 'request not found' using errcode = 'P0002'; end if;
  delete from public.friend_requests where from_id = me and to_id = requester;
  insert into public.friendships (user_a, user_b)
  values (least(me, requester), greatest(me, requester))
  on conflict do nothing;
end $$;

create function public.decline_request(request_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.friend_requests set declined_at = now() where id = request_id and to_id = auth.uid();
$$;

create function public.cancel_request(request_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friend_requests where id = request_id and from_id = auth.uid();
$$;

-- Past Shares in both directions are kept; only new sends are blocked.
create function public.remove_friend(friend_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friendships
  where user_a = least(auth.uid(), friend_id) and user_b = greatest(auth.uid(), friend_id);
$$;

create function public.mark_watched(vid text) returns integer
language sql security definer set search_path = '' as $$
  with marked as (
    update public.shares set watched_at = now()
    where recipient_id = auth.uid() and video_id = vid and watched_at is null
    returning 1
  )
  select count(*)::int from marked;
$$;

-- Deliberately has no declined column: a decline stays silent to the sender.
create function public.outgoing_requests()
returns table (id uuid, to_id uuid, handle text, display_name text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.to_id, p.handle, p.display_name, p.avatar_url, r.created_at
  from public.friend_requests r
  join public.profiles p on p.id = r.to_id
  where r.from_id = auth.uid()
  order by r.created_at desc;
$$;

-- Grants ---------------------------------------------------------------------------------------
-- Supabase grants EXECUTE to anon by default; nothing here is for signed-out callers.

revoke execute on all functions in schema public from public, anon;
revoke execute on function public.handle_new_user() from authenticated;
grant execute on function
  public.are_friends(uuid, uuid),
  public.can_see_profile(uuid),
  public.handle_available(text),
  public.claim_handle(text),
  public.find_user_by_handle(text),
  public.send_friend_request(text),
  public.accept_request(uuid),
  public.decline_request(uuid),
  public.cancel_request(uuid),
  public.remove_friend(uuid),
  public.mark_watched(text),
  public.outgoing_requests()
to authenticated;

-- Realtime (Phase 4 badge counts) -------------------------------------------------------------

alter publication supabase_realtime add table public.shares, public.friend_requests;
