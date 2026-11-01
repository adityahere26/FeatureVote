begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000002a', 'limited@test.invalid'),
  ('00000000-0000-0000-0000-00000000002b', 'other@test.invalid');
insert into public.workspaces (id, name, slug, is_public) values
  ('10000000-0000-0000-0000-00000000002a', 'Public', 'limits-public', true);

-- Direct server-side inserts have no user and are not limited.
insert into public.feature_requests (id, workspace_id, title) values
  ('20000000-0000-0000-0000-00000000002a', '10000000-0000-0000-0000-00000000002a', 'Target');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000002a","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.feature_requests (workspace_id, title)
    select '10000000-0000-0000-0000-00000000002a', 'Request ' || n from generate_series(1, 10) n$$,
  'ten requests in an hour are fine');
select throws_ok(
  $$insert into public.feature_requests (workspace_id, title) values
    ('10000000-0000-0000-0000-00000000002a', 'One too many')$$,
  'P0001', 'Rate limit exceeded', 'the eleventh request is refused');
select throws_ok(
  $$select public.create_workspace('Five', 'limit-' || n) from generate_series(1, 6) n$$,
  'P0001', 'Rate limit exceeded', 'workspace creation is limited');

select lives_ok(
  $$insert into public.comments (workspace_id, request_id, body)
    select '10000000-0000-0000-0000-00000000002a', '20000000-0000-0000-0000-00000000002a', 'c' || n
    from generate_series(1, 30) n$$,
  'thirty comments in an hour are fine');
delete from public.comments where request_id = '20000000-0000-0000-0000-00000000002a';
select throws_ok(
  $$insert into public.comments (workspace_id, request_id, body) values
    ('10000000-0000-0000-0000-00000000002a', '20000000-0000-0000-0000-00000000002a', 'again')$$,
  'P0001', 'Rate limit exceeded', 'deleting comments does not reset the limit');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000002b","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.feature_requests (workspace_id, title) values
    ('10000000-0000-0000-0000-00000000002a', 'Someone else')$$,
  'limits are per person');

select throws_ok(
  $$select * from private.rate_limits$$,
  '42501', null, 'the counters cannot be read or reset through the API');

select * from finish();
rollback;
