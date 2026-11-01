begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

-- Fixtures: alice owns private workspace A (bob is a member); dave owns public
-- workspace B; carol belongs to nothing.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.invalid'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.invalid'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@test.invalid'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@test.invalid'),
  ('00000000-0000-0000-0000-00000000000e', 'erin@test.invalid');

insert into public.workspaces (id, name, slug, is_public) values
  ('10000000-0000-0000-0000-00000000000a', 'Private A', 'private-a', false),
  ('10000000-0000-0000-0000-00000000000b', 'Public B', 'public-b', true);

insert into public.workspace_memberships (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000d', 'owner');

insert into public.feature_requests (id, workspace_id, author_id, title) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000a', 'Secret roadmap item'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-00000000000d', 'Dark mode'),
  ('20000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-00000000000c', 'Carol idea');

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint, 'every public table has RLS enabled');

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Member', 'profile is created at signup without leaking the email');

-- Anonymous visitor ------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*) from public.workspaces), 1::bigint, 'anon sees only public workspaces');
select is((select count(*) from public.feature_requests), 2::bigint, 'anon sees only public requests');
select throws_ok(
  $$insert into public.feature_requests (workspace_id, title)
    values ('10000000-0000-0000-0000-00000000000b', 'Anon spam')$$,
  '42501', null, 'anon cannot submit requests');
select throws_ok($$select * from public.workspace_memberships$$, '42501', null, 'anon cannot read memberships');
select throws_ok($$select * from public.votes$$, '42501', null, 'anon cannot read votes');
select throws_ok($$select * from public.platform_admins$$, '42501', null, 'anon cannot read platform admins');
select throws_ok($$select public.create_workspace('Nope', 'nope-nope')$$, '42501', null, 'anon cannot create workspaces');
select throws_ok(
  $$select public.add_vote('20000000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'anon cannot vote');

-- Carol, a signed-in outsider --------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

select is(
  (select count(*) from public.feature_requests
   where workspace_id = '10000000-0000-0000-0000-00000000000a'),
  0::bigint, 'outsider cannot read a private workspace');
select throws_ok(
  $$insert into public.feature_requests (workspace_id, title)
    values ('10000000-0000-0000-0000-00000000000a', 'Intruder')$$,
  '42501', null, 'outsider cannot submit to a private workspace');
select lives_ok(
  $$insert into public.feature_requests (workspace_id, title) values
    ('10000000-0000-0000-0000-00000000000b', 'Another idea')$$,
  'signed-in customer can submit to a public workspace');
select throws_ok(
  $$insert into public.feature_requests (workspace_id, title, status)
    values ('10000000-0000-0000-0000-00000000000b', 'Self approved', 'planned')$$,
  '42501', null, 'status cannot be set on insert');
select throws_ok(
  $$insert into public.feature_requests (workspace_id, title, author_id)
    values ('10000000-0000-0000-0000-00000000000b', 'Forged',
            '00000000-0000-0000-0000-00000000000d')$$,
  '42501', null, 'author cannot be forged');
select throws_ok(
  $$update public.feature_requests set status = 'released'
    where id = '20000000-0000-0000-0000-00000000000c'$$,
  '42501', null, 'authors cannot change the status of their own request');
select throws_ok(
  $$update public.feature_requests set vote_count = 9999
    where id = '20000000-0000-0000-0000-00000000000c'$$,
  '42501', null, 'authors cannot edit their own vote count');
select throws_ok(
  $$update public.feature_requests set workspace_id = '10000000-0000-0000-0000-00000000000a'
    where id = '20000000-0000-0000-0000-00000000000c'$$,
  '42501', null, 'requests cannot move between workspaces');
select lives_ok(
  $$update public.feature_requests set title = 'Carol edited'
    where id = '20000000-0000-0000-0000-00000000000b'$$,
  'updating someone else''s request does not error');
select is(
  (select title from public.feature_requests where id = '20000000-0000-0000-0000-00000000000b'),
  'Dark mode', 'customers cannot edit someone else''s request');
select throws_ok(
  $$select public.update_request_status('20000000-0000-0000-0000-00000000000b', 'released')$$,
  '42501', null, 'customers cannot change status through the function');
select throws_ok(
  $$insert into public.votes (workspace_id, request_id) values
    ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'outsider cannot vote in a private workspace');
select throws_ok(
  $$insert into public.votes (workspace_id, request_id) values
    ('10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000a')$$,
  '23503', null, 'a vote cannot point at another workspace''s request');
select throws_ok(
  $$insert into public.comments (workspace_id, request_id, body) values
    ('10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000a', 'hi')$$,
  '23503', null, 'a comment cannot point at another workspace''s request');
select is(public.add_vote('20000000-0000-0000-0000-00000000000b'), true, 'first vote is recorded');
select is(public.add_vote('20000000-0000-0000-0000-00000000000b'), false, 'second vote is a no-op');
select is(
  (select vote_count from public.feature_requests where id = '20000000-0000-0000-0000-00000000000b'),
  1, 'one person counts as one vote');
select throws_ok($$select token_hash from public.workspace_invites$$, '42501', null, 'invite hashes are unreadable');
select throws_ok($$select is_internal from public.workspaces$$, '42501', null, 'internal flag is hidden');
select throws_ok(
  $$insert into public.workspace_memberships (workspace_id, user_id) values
    ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c')$$,
  '42501', null, 'users cannot add themselves to a workspace');
select throws_ok(
  $$select public.create_invite('10000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'outsiders cannot create invites');
select throws_ok(
  $$select public.change_member_role('10000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000c', 'owner')$$,
  '42501', null, 'outsiders cannot grant themselves a role');

-- Bob, a plain member ----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is(
  (select count(*) from public.feature_requests
   where workspace_id = '10000000-0000-0000-0000-00000000000a'),
  1::bigint, 'members read their private workspace');
select throws_ok(
  $$select public.update_request_status('20000000-0000-0000-0000-00000000000a', 'planned')$$,
  '42501', null, 'members cannot change status');
select throws_ok(
  $$select public.remove_member('10000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'members cannot remove the owner');

-- Alice, the owner -------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is(
  (select changed from public.update_request_status('20000000-0000-0000-0000-00000000000a', 'planned')),
  true, 'owners can change status');
select is(
  (select changed from public.update_request_status('20000000-0000-0000-0000-00000000000a', 'planned')),
  false, 'setting the same status is a no-op');
select is(
  (select count(*) from public.request_status_history
   where request_id = '20000000-0000-0000-0000-00000000000a'),
  1::bigint, 'only real changes are recorded');
select throws_ok(
  $$select public.change_member_role('10000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000a', 'member')$$,
  'P0001', null, 'the last owner cannot be demoted');

select set_config('test.token', public.create_invite('10000000-0000-0000-0000-00000000000a'), true);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is(
  public.accept_invite(current_setting('test.token')),
  '10000000-0000-0000-0000-00000000000a'::uuid, 'an invite adds the user to the workspace');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_invite(current_setting('test.token'))$$,
  'P0002', null, 'invites are single use');

-- Account and workspace deletion ------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(
  (select count(*) from public.account_deletion_blockers()),
  1::bigint, 'sole owners are told which workspaces block deletion');

reset role;
select throws_ok(
  $$delete from auth.users where id = '00000000-0000-0000-0000-00000000000a'$$,
  'P0001', null, 'a sole owner cannot be deleted');

delete from auth.users where id = '00000000-0000-0000-0000-00000000000c';
select is(
  (select count(*) from public.feature_requests
   where id = '20000000-0000-0000-0000-00000000000c' and author_id is null),
  1::bigint, 'deleting an account keeps the feedback but removes the author');
select is(
  (select vote_count from public.feature_requests where id = '20000000-0000-0000-0000-00000000000b'),
  0, 'deleting an account removes their votes from the count');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$delete from public.workspaces where id = '10000000-0000-0000-0000-00000000000a'$$,
  'owners can delete a workspace, including their own last membership');
reset role;
select is(
  (select count(*) from public.feature_requests
   where workspace_id = '10000000-0000-0000-0000-00000000000a'),
  0::bigint, 'deleting a workspace removes its data');

select * from finish();
rollback;
