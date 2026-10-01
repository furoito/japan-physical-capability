# Execution Core v1 — source-ready, not live

This directory contains the minimum operational backend for Japan Physical Capability. It is intentionally **not deployed into the Affiliate Factory Supabase project**.

## Components

- `design/capability_execution_core_v1.sql`
  - request state
  - evidence metadata
  - append-only events
  - private Storage bucket
  - RLS enabled with no public policies
- `supabase/functions/japan-physical-capability-api/`
  - public request creation with bounded rate limiting
  - requester-token status and cancellation
  - operator review/approval/rejection via server secret
  - worker-token claim and completion
  - private photo storage + temporary signed URLs
- `supabase/functions/japan-physical-capability-mcp-next/`
  - future MCP `create/get/cancel` tools
  - **not live until the API has a dedicated deployment**
- `pilot/operator.html`
  - minimal manual review queue
- `pilot/worker.html`
  - minimal mobile-friendly task/claim/completion surface

## Required Edge Function secrets

- `CAPABILITY_HASH_SALT`: random secret used when hashing bearer capabilities and source fingerprints.
- `CAPABILITY_OPERATOR_KEY`: operator dashboard/admin API key.
- `CAPABILITY_WORKER_URL`: normally `https://furoito.github.io/japan-physical-capability/pilot/worker.html`.
- Supabase-provided `SUPABASE_URL` and secret API key environment variables.

## Activation gate

Do not expose the new MCP tools until all of these pass on a dedicated project:

1. migration applied outside Factory
2. API create/status/cancel round-trip
3. operator approve -> worker URL
4. worker claim -> complete with photo
5. requester status returns signed evidence URL
6. evidence URL expires and bucket remains private
7. invalid requester/worker/operator tokens fail closed
8. rate-limit behavior verified

Only then replace the current prepare-only MCP with the execution-capable version.
