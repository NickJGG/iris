-- Deletes the caller's auth user. Everything else cascades from it: profiles and seen_marks, then
-- friend_requests, friendships and shares (both directions) through profiles, then share_watches.

create function public.delete_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
