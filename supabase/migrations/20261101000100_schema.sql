-- Core FeatureVote tables. Access control lives in the next migration.

create extension if not exists pgcrypto with schema extensions;

create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.request_status as enum
  ('under_review', 'planned', 'in_progress', 'released', 'declined');

-- Public identity only. Emails stay in auth.users and are never copied here.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  is_public boolean not null default false,
  -- Excludes the operator's own test workspaces from metrics.
  is_internal boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.workspace_memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_memberships_user_id_idx on public.workspace_memberships (user_id);

-- Only the SHA-256 of an invite token is stored; the token is shown once.
create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token_hash text not null unique,
  role public.workspace_role not null default 'member' check (role <> 'owner'),
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index workspace_invites_workspace_id_idx on public.workspace_invites (workspace_id);

create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Null once the author deletes their account; the feedback itself remains.
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  body text not null default '' check (char_length(body) <= 5000),
  status public.request_status not null default 'under_review',
  vote_count integer not null default 0 check (vote_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  search tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, title), 'A') ||
    setweight(to_tsvector('english'::regconfig, body), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite foreign keys that pin children to one workspace.
  unique (workspace_id, id)
);
create index feature_requests_workspace_status_idx
  on public.feature_requests (workspace_id, status, created_at desc);
create index feature_requests_workspace_votes_idx
  on public.feature_requests (workspace_id, vote_count desc);
create index feature_requests_author_id_idx on public.feature_requests (author_id);
create index feature_requests_search_idx on public.feature_requests using gin (search);

create table public.votes (
  workspace_id uuid not null,
  request_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id),
  foreign key (workspace_id, request_id)
    references public.feature_requests (workspace_id, id) on delete cascade
);
create index votes_user_id_idx on public.votes (user_id);
create index votes_workspace_request_idx on public.votes (workspace_id, request_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  request_id uuid not null,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, request_id)
    references public.feature_requests (workspace_id, id) on delete cascade
);
create index comments_request_idx on public.comments (request_id, created_at);
create index comments_workspace_request_idx on public.comments (workspace_id, request_id);
create index comments_author_id_idx on public.comments (author_id);

create table public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  request_id uuid not null,
  from_status public.request_status not null,
  to_status public.request_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, request_id)
    references public.feature_requests (workspace_id, id) on delete cascade
);
create index request_status_history_request_idx
  on public.request_status_history (request_id, created_at);
create index request_status_history_workspace_request_idx
  on public.request_status_history (workspace_id, request_id);

-- Operators allowed to open the cross-workspace analytics dashboard.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
