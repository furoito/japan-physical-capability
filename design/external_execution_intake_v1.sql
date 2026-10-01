-- Applied to dedicated japan-physical-capability Supabase project on 2026-10-01.
-- Broadens the demand-discovery intake without changing execution authorization.

alter table public.capability_jobs
  alter column location drop not null;

alter table public.capability_jobs
  add column if not exists request_kind text not null default 'physical_verification',
  add column if not exists max_budget_jpy integer;

-- Canonical constraints in the live schema:
-- request_kind in ('physical_verification','external_execution')
-- max_budget_jpy is null or between 0 and 10000000
--
-- Generic external-execution requests may omit location.
-- max_budget_jpy is non-binding metadata only; it does not authorize spending.
