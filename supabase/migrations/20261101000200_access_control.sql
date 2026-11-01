-- Row Level Security, column grants, and the functions behind privileged actions.
--
-- Supabase's publishable key is public, so anyone can call these tables without
-- going through the app. Everything here must hold on its own.

create schema private;
grant usage on schema private to anon, authenticated;

-- Membership lookups. SECURITY DEFINER so policies on workspace_memberships
-- don't recurse. Each takes no row input, so policies can wrap them in a
-- subquery and the planner evaluates them once per statement.
create function private.member_workspace_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.workspace_memberships
  where user_id = (select auth.uid());
$$;

create function private.admin_workspace_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.workspace_memberships
  where user_id = (select auth.uid()) and role in ('owner', 'admin');
$$;

create function private.owner_workspace_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.workspace_memberships
  where user_id = (select auth.uid()) and role = 'owner';
$$;

create function private.readable_workspace_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.workspaces where is_public
  union
  select workspace_id from public.workspace_memberships
  where user_id = (select auth.uid());
$$;

-- Customers are not members: any signed-in user may take part on a public board.
create function private.writable_workspace_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.workspaces where is_public and (select auth.uid()) is not null
  union
  select workspace_id from public.workspace_memberships
  where user_id = (select auth.uid());
$$;

revoke execute on all functions in schema private from public;
grant execute on function
  private.member_workspace_ids(),
  private.admin_workspace_ids(),
  private.owner_workspace_ids(),
  private.readable_workspace_ids(),
  private.writable_workspace_ids()
to anon, authenticated;

-- Triggers ---------------------------------------------------------------------

create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(left(new.raw_user_meta_data ->> 'full_name', 80)), ''),
      nullif(btrim(left(new.raw_user_meta_data ->> 'name', 80)), ''),
      'Member'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger feature_requests_touch before update of title, body, status
  on public.feature_requests
  for each row execute function private.touch_updated_at();

create trigger comments_touch before update of body
  on public.comments
  for each row execute function private.touch_updated_at();

create function private.sync_vote_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.feature_requests set vote_count = vote_count + 1 where id = new.request_id;
  else
    update public.feature_requests set vote_count = vote_count - 1 where id = old.request_id;
  end if;
  return null;
end;
$$;

create trigger votes_sync_count after insert or delete on public.votes
  for each row execute function private.sync_vote_count();

create function private.sync_comment_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.feature_requests set comment_count = comment_count + 1 where id = new.request_id;
  else
    update public.feature_requests set comment_count = comment_count - 1 where id = old.request_id;
  end if;
  return null;
end;
$$;

create trigger comments_sync_count after insert or delete on public.comments
  for each row execute function private.sync_comment_count();

-- A workspace can never be left without an owner. This also blocks deleting the
-- account of a sole owner, until they transfer or delete the workspace.
create function private.protect_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role <> 'owner' or (tg_op = 'UPDATE' and new.role = 'owner') then
    return coalesce(new, old);
  end if;

  -- The workspace itself is being deleted when this finds no row.
  perform 1 from public.workspaces where id = old.workspace_id for update;
  if not found then
    return coalesce(new, old);
  end if;

  if not exists (
    select 1 from public.workspace_memberships
    where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id
  ) then
    raise exception 'A workspace must keep at least one owner'
      using errcode = 'P0001', hint = 'last_owner';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_protect_last_owner
  before update of role or delete on public.workspace_memberships
  for each row execute function private.protect_last_owner();

-- Grants ------------------------------------------------------------------------
-- Supabase grants everything on public tables by default. Start from nothing, then
-- allow only named columns: RLS filters rows but cannot restrict columns, so these
-- grants are what stop an author from rewriting their request's status or counters.

revoke all on all tables in schema public from anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select (id, name, slug, is_public, created_at) on public.workspaces to anon, authenticated;
grant update (name, is_public) on public.workspaces to authenticated;
grant delete on public.workspaces to authenticated;

grant select on public.workspace_memberships to authenticated;

-- token_hash is deliberately not readable by anyone through the API.
grant select (id, workspace_id, role, expires_at, accepted_at, revoked_at, created_at)
  on public.workspace_invites to authenticated;

grant select (id, workspace_id, author_id, title, body, status, vote_count, comment_count,
              search, created_at, updated_at)
  on public.feature_requests to anon, authenticated;
grant insert (workspace_id, title, body) on public.feature_requests to authenticated;
grant update (title, body) on public.feature_requests to authenticated;
grant delete on public.feature_requests to authenticated;

-- Votes are readable only by their owner; the public sees vote_count.
grant select, delete on public.votes to authenticated;
grant insert (workspace_id, request_id) on public.votes to authenticated;

grant select on public.comments to anon, authenticated;
grant insert (workspace_id, request_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

grant select (id, workspace_id, request_id, from_status, to_status, created_at)
  on public.request_status_history to anon, authenticated;

-- Row Level Security -----------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.feature_requests enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.request_status_history enable row level security;
alter table public.platform_admins enable row level security;
-- platform_admins has no grants or policies: only server-side code can read it.

create policy "Profiles are public" on public.profiles
  for select to anon, authenticated using (true);
create policy "Users edit their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Readable workspaces" on public.workspaces
  for select to anon, authenticated
  using (id in (select private.readable_workspace_ids()));
create policy "Admins update workspaces" on public.workspaces
  for update to authenticated
  using (id in (select private.admin_workspace_ids()))
  with check (id in (select private.admin_workspace_ids()));
create policy "Owners delete workspaces" on public.workspaces
  for delete to authenticated
  using (id in (select private.owner_workspace_ids()));

create policy "Members see their workspace's members" on public.workspace_memberships
  for select to authenticated
  using (workspace_id in (select private.member_workspace_ids()));

create policy "Admins see invites" on public.workspace_invites
  for select to authenticated
  using (workspace_id in (select private.admin_workspace_ids()));

create policy "Readable requests" on public.feature_requests
  for select to anon, authenticated
  using (workspace_id in (select private.readable_workspace_ids()));
create policy "Participants submit requests" on public.feature_requests
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and workspace_id in (select private.writable_workspace_ids())
  );
create policy "Authors and admins edit requests" on public.feature_requests
  for update to authenticated
  using (
    workspace_id in (select private.admin_workspace_ids())
    or (author_id = (select auth.uid())
        and workspace_id in (select private.writable_workspace_ids()))
  )
  with check (workspace_id in (select private.writable_workspace_ids()));
create policy "Authors and admins delete requests" on public.feature_requests
  for delete to authenticated
  using (
    workspace_id in (select private.admin_workspace_ids())
    or (author_id = (select auth.uid())
        and workspace_id in (select private.writable_workspace_ids()))
  );

create policy "Users see their own votes" on public.votes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Participants vote" on public.votes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and workspace_id in (select private.writable_workspace_ids())
  );
create policy "Users remove their own votes" on public.votes
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Readable comments" on public.comments
  for select to anon, authenticated
  using (workspace_id in (select private.readable_workspace_ids()));
create policy "Participants comment" on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and workspace_id in (select private.writable_workspace_ids())
  );
create policy "Authors edit comments" on public.comments
  for update to authenticated
  using (
    author_id = (select auth.uid())
    and workspace_id in (select private.writable_workspace_ids())
  )
  with check (author_id = (select auth.uid()));
create policy "Authors and admins delete comments" on public.comments
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or workspace_id in (select private.admin_workspace_ids())
  );

create policy "Readable status history" on public.request_status_history
  for select to anon, authenticated
  using (workspace_id in (select private.readable_workspace_ids()));

-- Privileged actions -----------------------------------------------------------
-- SECURITY DEFINER functions in an exposed schema: each one does its own
-- authorization check, and all are revoked from anon below.

create function public.create_workspace(p_name text, p_slug text, p_is_public boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  insert into public.workspaces (name, slug, is_public, created_by)
  values (p_name, p_slug, p_is_public, v_user)
  returning id into v_id;

  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (v_id, v_user, 'owner');

  return v_id;
end;
$$;

-- Returns whether a row was actually added, so double clicks fire one analytics event.
create function public.add_vote(p_request_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_workspace uuid;
  v_rows integer;
begin
  select workspace_id into v_workspace from public.feature_requests where id = p_request_id;
  if v_workspace is null then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;

  insert into public.votes (workspace_id, request_id)
  values (v_workspace, p_request_id)
  on conflict (request_id, user_id) do nothing;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- Status changes and their history commit together or not at all.
create function public.update_request_status(p_request_id uuid, p_status public.request_status)
returns table (workspace_id uuid, from_status public.request_status, changed boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_workspace uuid;
  v_from public.request_status;
begin
  select r.workspace_id, r.status into v_workspace, v_from
  from public.feature_requests r where r.id = p_request_id for update;

  if v_workspace is null then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.workspace_memberships m
    where m.workspace_id = v_workspace and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_from = p_status then
    return query select v_workspace, v_from, false;
    return;
  end if;

  update public.feature_requests set status = p_status where id = p_request_id;
  insert into public.request_status_history
    (workspace_id, request_id, from_status, to_status, changed_by)
  values (v_workspace, p_request_id, v_from, p_status, auth.uid());

  return query select v_workspace, v_from, true;
end;
$$;

-- Returns the raw token once. It cannot be recovered afterwards.
create function public.create_invite(
  p_workspace_id uuid,
  p_role public.workspace_role default 'member',
  p_expires_in interval default interval '7 days'
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_caller public.workspace_role;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select role into v_caller from public.workspace_memberships
  where workspace_id = p_workspace_id and user_id = auth.uid();

  if v_caller is null or v_caller = 'member' or (p_role = 'admin' and v_caller <> 'owner') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'Owners cannot be invited' using errcode = '22023';
  end if;
  if p_expires_in <= interval '0' or p_expires_in > interval '30 days' then
    raise exception 'Invites last at most 30 days' using errcode = '22023';
  end if;

  insert into public.workspace_invites (workspace_id, token_hash, role, created_by, expires_at)
  values (
    p_workspace_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    p_role,
    auth.uid(),
    now() + p_expires_in
  );

  return v_token;
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.workspace_invites i set revoked_at = now()
  where i.id = p_invite_id
    and i.revoked_at is null
    and i.accepted_at is null
    and exists (
      select 1 from public.workspace_memberships m
      where m.workspace_id = i.workspace_id and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    );
  if not found then
    raise exception 'Invite not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Failure reasons are not distinguished, so tokens can't be probed.
create function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_invite public.workspace_invites;
begin
  if v_user is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_invite from public.workspace_invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and accepted_at is null and revoked_at is null and expires_at > now()
  for update;

  if v_invite.id is null then
    raise exception 'Invite is invalid or expired' using errcode = 'P0002';
  end if;

  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (v_invite.workspace_id, v_user, v_invite.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites
  set accepted_by = v_user, accepted_at = now()
  where id = v_invite.id;

  return v_invite.workspace_id;
end;
$$;

create function public.change_member_role(
  p_workspace_id uuid, p_user_id uuid, p_role public.workspace_role
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.workspace_memberships
    where workspace_id = p_workspace_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.workspace_memberships set role = p_role
  where workspace_id = p_workspace_id and user_id = p_user_id;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Anyone may leave; admins may remove members; only owners may remove admins or owners.
create function public.remove_member(p_workspace_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_caller public.workspace_role;
  v_target public.workspace_role;
begin
  select role into v_caller from public.workspace_memberships
  where workspace_id = p_workspace_id and user_id = auth.uid();
  select role into v_target from public.workspace_memberships
  where workspace_id = p_workspace_id and user_id = p_user_id;

  if v_caller is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_target is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if p_user_id <> auth.uid()
     and not (v_caller = 'owner' or (v_caller = 'admin' and v_target = 'member')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  delete from public.workspace_memberships
  where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

-- Workspaces that must be transferred or deleted before this account can go.
create function public.account_deletion_blockers()
returns table (workspace_id uuid, workspace_name text)
language sql stable security definer set search_path = '' as $$
  select w.id, w.name
  from public.workspace_memberships m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = auth.uid() and m.role = 'owner'
    and not exists (
      select 1 from public.workspace_memberships other
      where other.workspace_id = m.workspace_id
        and other.role = 'owner' and other.user_id <> m.user_id
    );
$$;

revoke execute on function
  public.create_workspace(text, text, boolean),
  public.add_vote(uuid),
  public.update_request_status(uuid, public.request_status),
  public.create_invite(uuid, public.workspace_role, interval),
  public.revoke_invite(uuid),
  public.accept_invite(text),
  public.change_member_role(uuid, uuid, public.workspace_role),
  public.remove_member(uuid, uuid),
  public.account_deletion_blockers()
from public, anon;

grant execute on function
  public.create_workspace(text, text, boolean),
  public.add_vote(uuid),
  public.update_request_status(uuid, public.request_status),
  public.create_invite(uuid, public.workspace_role, interval),
  public.revoke_invite(uuid),
  public.accept_invite(text),
  public.change_member_role(uuid, uuid, public.workspace_role),
  public.remove_member(uuid, uuid),
  public.account_deletion_blockers()
to authenticated;
