-- Per-user limits, enforced in the database so they also apply to direct API
-- calls. A counter table is used instead of counting rows, so deleting a row and
-- posting again can't get around a limit.

create table private.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (user_id, action, window_start)
);

-- Trigger arguments: action name, maximum per hour.
create function private.enforce_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  -- Server-side work has no user and isn't limited.
  if v_user is null then
    return new;
  end if;

  delete from private.rate_limits
  where user_id = v_user and window_start < now() - interval '1 day';

  insert into private.rate_limits (user_id, action, window_start)
  values (v_user, tg_argv[0], date_trunc('hour', now()))
  on conflict (user_id, action, window_start)
  do update set count = private.rate_limits.count + 1
  returning count into v_count;

  if v_count > tg_argv[1]::integer then
    raise exception 'Rate limit exceeded' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;

create trigger workspaces_rate_limit before insert on public.workspaces
  for each row execute function private.enforce_rate_limit('create_workspace', '5');
create trigger workspace_invites_rate_limit before insert on public.workspace_invites
  for each row execute function private.enforce_rate_limit('create_invite', '20');
create trigger feature_requests_rate_limit before insert on public.feature_requests
  for each row execute function private.enforce_rate_limit('submit_request', '10');
create trigger comments_rate_limit before insert on public.comments
  for each row execute function private.enforce_rate_limit('add_comment', '30');
create trigger votes_rate_limit before insert on public.votes
  for each row execute function private.enforce_rate_limit('add_vote', '200');
