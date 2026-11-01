begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000001a', 'owner@test.invalid'),
  ('00000000-0000-0000-0000-00000000001b', 'customer@test.invalid'),
  ('00000000-0000-0000-0000-00000000001c', 'other@test.invalid');

insert into public.workspaces (id, name, slug, is_public) values
  ('10000000-0000-0000-0000-00000000001a', 'Public', 'requests-public', true);
insert into public.workspace_memberships (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-00000000001a', 'owner');

insert into public.feature_requests (id, workspace_id, author_id, title, body) values
  ('20000000-0000-0000-0000-00000000001a', '10000000-0000-0000-0000-00000000001a',
   '00000000-0000-0000-0000-00000000001b', 'Keyboard shortcuts', 'Notifies reviewers');

insert into public.comments (id, workspace_id, request_id, author_id, body) values
  ('30000000-0000-0000-0000-00000000001a', '10000000-0000-0000-0000-00000000001a',
   '20000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-00000000001b', 'Mine');

select is(
  (select comment_count from public.feature_requests where id = '20000000-0000-0000-0000-00000000001a'),
  1, 'comment count follows inserts');
select is(
  (select count(*) from public.feature_requests
   where id = '20000000-0000-0000-0000-00000000001a'
     and search @@ websearch_to_tsquery('english', 'notify')),
  1::bigint, 'search matches stemmed words in the body');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000001c","role":"authenticated"}', true);

delete from public.comments where id = '30000000-0000-0000-0000-00000000001a';
delete from public.feature_requests where id = '20000000-0000-0000-0000-00000000001a';
select is(
  (select count(*) from public.comments where id = '30000000-0000-0000-0000-00000000001a'),
  1::bigint, 'customers cannot delete someone else''s comment');
select is(
  (select count(*) from public.feature_requests where id = '20000000-0000-0000-0000-00000000001a'),
  1::bigint, 'customers cannot delete someone else''s request');
select throws_ok(
  $$insert into public.comments (workspace_id, request_id, body, author_id) values
    ('10000000-0000-0000-0000-00000000001a', '20000000-0000-0000-0000-00000000001a', 'x',
     '00000000-0000-0000-0000-00000000001b')$$,
  '42501', null, 'comment authors cannot be forged');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000001b","role":"authenticated"}', true);
select throws_ok(
  $$update public.comments set request_id = '20000000-0000-0000-0000-00000000001a'
    where id = '30000000-0000-0000-0000-00000000001a'$$,
  '42501', null, 'comments cannot be moved between requests');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000001a","role":"authenticated"}', true);
delete from public.comments where id = '30000000-0000-0000-0000-00000000001a';
select is(
  (select comment_count from public.feature_requests where id = '20000000-0000-0000-0000-00000000001a'),
  0, 'admins can moderate comments, and the count follows');

delete from public.feature_requests where id = '20000000-0000-0000-0000-00000000001a';
select is(
  (select count(*) from public.feature_requests where id = '20000000-0000-0000-0000-00000000001a'),
  0::bigint, 'admins can delete requests');

select * from finish();
rollback;
