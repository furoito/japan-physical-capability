# Execution Core v1 — live pilot

The minimum operational backend for Japan Physical Capability is live on a **dedicated Supabase project**, separate from Affiliate Factory production.

## Live components

- `design/capability_execution_core_v1.sql`
  - request state
  - evidence metadata
  - append-only events
  - private Storage bucket
  - RLS enabled with no public policies
- `supabase/functions/japan-physical-capability-api/`
  - public, bounded request creation
  - retry-safe idempotent create
  - requester capability-token status and cancellation
  - worker capability-token claim and completion
  - private photo storage + temporary signed URLs
  - operator routes fail closed unless an operator key is explicitly provisioned
- `supabase/functions/japan-physical-capability-mcp/`
  - generic demand probe: `request_external_execution`, `get_external_execution_status`, `cancel_external_execution_request`
  - validated physical path: `check_service_fit`, `prepare_verification_request`, `create_verification_request`, `get_verification_status`, `cancel_verification_request`
- `pilot/worker.html`
  - minimal mobile-friendly worker surface pointed at the dedicated execution API
- `pilot/operator.html`
  - source retained, but public operator auth is not enabled in the live pilot; current manual review is admin/control-plane mediated

## Live endpoints

- Execution API: `https://bqgfqedetmxrfpvmdfmc.supabase.co/functions/v1/japan-physical-capability-api`
- Remote MCP: `https://bqgfqedetmxrfpvmdfmc.supabase.co/functions/v1/japan-physical-capability-mcp`

## Security / reliability properties verified

- RLS enabled and no anon/authenticated table policies
- private evidence bucket; direct public object fetch denied
- temporary signed evidence URL successfully fetched after completion
- invalid requester and worker capability tokens fail closed
- unauthenticated operator route returns 401
- bounded request rate limit verified
- retry with the same idempotency key recovers the same request and requester token
- repeated cancellation is idempotent
- synthetic full E2E passed: request -> review -> worker -> evidence -> structured result -> requester
- synthetic jobs and evidence were cleaned after probes

## Remaining deliberate limits

- manual approval
- no automated payment / escrow
- no open worker marketplace
- no KYC / worker ratings
- no automatic pricing / SLA
- no regulated or private-location work

These are intentionally deferred until repeated real demand justifies abstraction.

## v0.4 demand probe

Generic requests are stored with `request_kind=external_execution`. `location` is optional for generic intake, and `max_budget_jpy` is a non-binding willingness-to-pay hint. Every request remains `pending_review` until a human explicitly approves it. No automatic spending or fulfillment is enabled.
