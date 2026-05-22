create table if not exists repos (
  id bigserial primary key,
  full_name text not null unique,
  owner text not null,
  name text not null,
  track text not null check (track in ('backend', 'frontend', 'android')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists members (
  github_id text primary key,
  nickname text,
  cohort integer,
  roles text[],
  track text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists pull_requests (
  id bigserial primary key,
  github_node_id text unique,
  repo_id bigint not null references repos(id),
  pr_number integer not null,
  title text,
  author_login text,
  created_at timestamptz not null,
  closed_at timestamptz,
  merged_at timestamptz,
  github_updated_at timestamptz,
  url text,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repo_id, pr_number)
);

create table if not exists review_events (
  id bigserial primary key,
  github_node_id text unique,
  event_key text unique,
  pr_id bigint not null references pull_requests(id) on delete cascade,
  reviewer_login text,
  author_role text not null check (author_role in ('crew', 'reviewer', 'unknown')),
  state text,
  submitted_at timestamptz not null,
  url text,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table review_events add column if not exists event_key text;

create table if not exists sync_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'failed')),
  mode text not null check (mode in ('full', 'incremental')),
  fetched_prs integer not null default 0,
  fetched_reviews integer not null default 0,
  error_message text
);

create table if not exists person_summary_stats (
  github_id text primary key,
  nickname text,
  avatar_url text,
  track text,
  cohort integer,
  as_crew jsonb not null default '{}'::jsonb,
  as_reviewer jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists repo_summary_stats (
  repo_full_name text primary key,
  track text not null,
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists recent_activities (
  id bigserial primary key,
  github_id text not null,
  nickname text,
  avatar_url text,
  role text not null check (role in ('crew', 'reviewer')),
  track text,
  repo_full_name text,
  pr_number integer,
  event_type text not null,
  occurred_at timestamptz not null,
  url text
);

create table if not exists reviewer_match_scores (
  crew_github_id text not null,
  reviewer_github_id text not null,
  score numeric not null,
  time_overlap_score numeric not null,
  first_review_speed_score numeric not null,
  rereview_speed_score numeric not null,
  same_track_repo_score numeric not null,
  recent_activity_score numeric not null,
  first_review_median_hours numeric,
  rereview_median_hours numeric,
  same_track_review_count integer not null default 0,
  same_repo_review_count integer not null default 0,
  recent_30d_review_count integer not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (crew_github_id, reviewer_github_id)
);

create index if not exists pull_requests_repo_created_idx on pull_requests (repo_id, created_at desc);
create index if not exists pull_requests_author_idx on pull_requests (author_login);
create index if not exists pull_requests_github_updated_idx on pull_requests (github_updated_at desc);
create index if not exists review_events_pr_idx on review_events (pr_id, submitted_at);
create unique index if not exists review_events_event_key_idx on review_events (event_key);
create index if not exists review_events_reviewer_idx on review_events (reviewer_login, submitted_at desc);
create index if not exists review_events_role_idx on review_events (author_role, submitted_at desc);
create index if not exists recent_activities_role_time_idx on recent_activities (role, occurred_at desc);
create index if not exists reviewer_match_scores_crew_score_idx on reviewer_match_scores (crew_github_id, score desc);
