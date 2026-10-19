-- RLS assertions for Iris. Paste into the Supabase SQL editor and run as a whole.
-- Creates three throwaway users (A, B, C) inside one transaction and rolls it all back.
-- Any failed assertion aborts with "FAIL: …"; success ends with a single "all RLS assertions passed" row.

begin;

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'rls-a@iris.test', '{"full_name":"Rls A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'rls-b@iris.test', '{"full_name":"Rls B"}'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'rls-c@iris.test', '{"full_name":"Rls C"}');

do $$ begin
  if (select count(*) from public.profiles where id in (
    '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c'
  )) <> 3 then raise exception 'FAIL: sign-up trigger did not create profiles'; end if;
end $$;

-- ===== Signed out ==========================================================================
set local role anon;

do $$ begin
  if (select count(*) from public.profiles) <> 0 then raise exception 'FAIL: anon can read profiles'; end if;
  if (select count(*) from public.shares) <> 0 then raise exception 'FAIL: anon can read shares'; end if;
  begin
    perform public.find_user_by_handle('rls_test_b');
    raise exception 'FAIL: anon can call find_user_by_handle';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- ===== A: handles and no enumeration ========================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

do $$ begin
  perform public.claim_handle('rls_test_a');
  if public.handle_available('rls_test_a') is not true then raise exception 'FAIL: own handle reported taken'; end if;
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;

do $$ begin
  if public.handle_available('rls_test_a') then raise exception 'FAIL: taken handle reported available'; end if;
  begin
    perform public.claim_handle('rls_test_a');
    raise exception 'FAIL: claimed a taken handle';
  exception when unique_violation then null;
  end;
  perform public.claim_handle('rls_test_b');
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
do $$ begin perform public.claim_handle('rls_test_c'); end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: A can enumerate profiles'; end if;
  if (select count(*) from public.find_user_by_handle('rls_test_b')) <> 1 then raise exception 'FAIL: exact handle not found'; end if;
  if (select count(*) from public.find_user_by_handle('RLS_TEST_B')) <> 1 then raise exception 'FAIL: handle lookup is case-sensitive'; end if;
  if (select count(*) from public.find_user_by_handle('rls_test')) <> 0 then raise exception 'FAIL: prefix handle matched'; end if;
  if (select count(*) from public.find_user_by_handle('rls_test_%')) <> 0 then raise exception 'FAIL: wildcard handle matched'; end if;
  if public.are_friends('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c') then
    raise exception 'FAIL: are_friends answers for pairs the caller is not in';
  end if;
end $$;

-- ===== No shares to non-friends =============================================================
do $$ begin
  begin
    insert into public.shares (recipient_id, video_id) values ('00000000-0000-0000-0000-00000000000b', 'dQw4w9WgXcQ');
    raise exception 'FAIL: A shared to non-friend B';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A requests B and C.
do $$ begin
  perform public.send_friend_request('rls_test_b');
  perform public.send_friend_request('rls_test_c');
  if (select count(*) from public.outgoing_requests()) <> 2 then raise exception 'FAIL: outgoing requests missing'; end if;
  if (select count(*) from public.profiles) <> 3 then raise exception 'FAIL: A cannot see request counterparties'; end if;
end $$;

-- B accepts; C declines.
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.accept_request((select id from public.friend_requests where from_id = '00000000-0000-0000-0000-00000000000a'));
  if not public.are_friends('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b') then
    raise exception 'FAIL: accept did not create a friendship';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.decline_request((select id from public.friend_requests where from_id = '00000000-0000-0000-0000-00000000000a'));
  if (select count(*) from public.friend_requests) <> 0 then raise exception 'FAIL: declined request still listed for C'; end if;
  if (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000b') <> 0 then
    raise exception 'FAIL: C can see unrelated B';
  end if;
end $$;

-- ===== Sender can't see a decline ===========================================================
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.friend_requests) <> 0 then raise exception 'FAIL: sender can select friend_requests directly'; end if;
  if (select count(*) from public.outgoing_requests() r where r.to_id = '00000000-0000-0000-0000-00000000000c') <> 1 then
    raise exception 'FAIL: declined request vanished for sender';
  end if;
  if exists (select 1 from public.outgoing_requests() r where to_jsonb(r) ? 'declined_at') then
    raise exception 'FAIL: outgoing_requests exposes declined_at';
  end if;
  perform public.send_friend_request('rls_test_c');
  if (select count(*) from public.outgoing_requests()) <> 1 then raise exception 'FAIL: re-request after decline changed state'; end if;
end $$;

-- ===== Shares between friends ===============================================================
do $$ begin
  insert into public.shares (recipient_id, video_id, note) values ('00000000-0000-0000-0000-00000000000b', 'dQw4w9WgXcQ', 'rls test');
  begin
    insert into public.shares (recipient_id, video_id) values ('00000000-0000-0000-0000-00000000000b', 'dQw4w9WgXcQ');
    raise exception 'FAIL: duplicate share allowed';
  exception when unique_violation then null;
  end;
  begin
    insert into public.shares (sender_id, recipient_id, video_id)
    values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'aaaaaaaaaaa');
    raise exception 'FAIL: A forged a share as B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.shares (recipient_id, video_id, watched_at) values ('00000000-0000-0000-0000-00000000000b', 'bbbbbbbbbbb', now());
    raise exception 'FAIL: sender pre-marked a share watched';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== Only the recipient can mark watched ==================================================
do $$
declare n int;
begin
  perform public.mark_watched('dQw4w9WgXcQ');
  with u as (update public.shares set watched_at = now() returning 1) select count(*) into n from u;
  if n <> 0 then raise exception 'FAIL: sender updated a share directly'; end if;
  if (select watched_at from public.shares where video_id = 'dQw4w9WgXcQ') is not null then
    raise exception 'FAIL: sender marked a share watched';
  end if;
end $$;

-- C is not a party to the share and can't see it.
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.shares) <> 0 then raise exception 'FAIL: third party can see a share'; end if;
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  if (select count(*) from public.shares) <> 1 then raise exception 'FAIL: recipient cannot see the share'; end if;
  with u as (update public.shares set watched_at = now() returning 1) select count(*) into n from u;
  if n <> 0 then raise exception 'FAIL: recipient updated a share directly'; end if;
  if public.mark_watched('dQw4w9WgXcQ') <> 1 then raise exception 'FAIL: recipient could not mark watched'; end if;
  if (select watched_at from public.shares where video_id = 'dQw4w9WgXcQ') is null then
    raise exception 'FAIL: mark_watched did not set watched_at';
  end if;

-- ===== Only the sender can delete (Unsend) ==================================================
  with d as (delete from public.shares returning 1) select count(*) into n from d;
  if n <> 0 then raise exception 'FAIL: recipient deleted a share'; end if;
end $$;

-- Removing a friend keeps past shares but blocks new ones.
do $$ begin
  perform public.remove_friend('00000000-0000-0000-0000-00000000000a');
  if (select count(*) from public.shares) <> 1 then raise exception 'FAIL: remove_friend dropped past shares'; end if;
  if (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') <> 1 then
    raise exception 'FAIL: share counterparty profile hidden after removal';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  begin
    insert into public.shares (recipient_id, video_id) values ('00000000-0000-0000-0000-00000000000b', 'ccccccccccc');
    raise exception 'FAIL: shared to a removed friend';
  exception when insufficient_privilege then null;
  end;
  with d as (delete from public.shares returning 1) select count(*) into n from d;
  if n <> 1 then raise exception 'FAIL: sender could not unsend'; end if;
end $$;

reset role;
rollback;

select 'all RLS assertions passed' as result;
