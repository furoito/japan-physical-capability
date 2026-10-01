-- Applied to dedicated japan-physical-capability Supabase project on 2026-10-01.
-- Broadens the demand-discovery intake without changing execution authorization.

alter table public.capability_jobs
  alter column location drop not null;

alter table public.capability_jobs
  add column if not exists request_kind text not null default 'physical_verification',
  add column if not exists max_budget_amount numeric,
  add column if not exists max_budget_currency text;

-- Canonical constraints:
-- request_kind in ('physical_verification','external_execution')
-- max_budget_amount is null or >= 0
-- max_budget_currency is null or three uppercase ASCII letters
