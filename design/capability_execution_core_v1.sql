-- Source-only migration for a dedicated Supabase project.
-- DO NOT apply to the Affiliate Factory production database.

create table if not exists public.capability_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending_review'
    check (status in ('pending_review','open','claimed','completed','rejected','cancelled')),
  requester_token_hash text not null unique,
  worker_token_hash text unique,
  idempotency_key_hash text unique,
  source_fingerprint text,
  location text not null check (char_length(location) between 2 and 500),
  objective text not null check (char_length(objective) between 3 and 4000),
  deadline timestamptz,
  evidence_requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_requirements) = 'array'),
  constraints jsonb not null default '[]'::jsonb check (jsonb_typeof(constraints) = 'array'),
  result_summary text,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  claimed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists capability_jobs_status_created_idx
  on public.capability_jobs(status, created_at desc);
create index if not exists capability_jobs_source_created_idx
  on public.capability_jobs(source_fingerprint, created_at desc);

create table if not exists public.capability_evidence (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.capability_jobs(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists capability_evidence_job_idx
  on public.capability_evidence(job_id, created_at);

create table if not exists public.capability_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.capability_jobs(id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('requester','operator','worker','system')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists capability_job_events_job_idx
  on public.capability_job_events(job_id, created_at);

alter table public.capability_jobs enable row level security;
alter table public.capability_evidence enable row level security;
alter table public.capability_job_events enable row level security;

-- Deliberately no anon/authenticated policies. All access is mediated by Edge Functions
-- using a server-side Supabase secret key. RLS therefore fails closed for public clients.

revoke all on table public.capability_jobs from anon, authenticated;
revoke all on table public.capability_evidence from anon, authenticated;
revoke all on table public.capability_job_events from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'capability-evidence',
  'capability-evidence',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
