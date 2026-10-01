# Distribution status

Canonical distribution checkpoint for the Japan Physical Capability discovery probe.

## Live

- Official MCP Registry
  - name: `io.github.furoito/japan-physical-capability`
  - version: `0.4.0`
  - remote transport: Streamable HTTP
  - source of truth: `server.json`
- GitHub public repository
- GitHub Pages
- `llms.txt`
- `capability.json`

## Downstream discovery paths

- Glama: LIVE as connector at `io.github.furoito/japan-physical-capability`; connector page and score badge are reachable. `glama.json` is present.
- MCPNav: documented to sync from the Official MCP Registry on its refresh cycle.
- PulseMCP / other aggregators: may ingest the Official MCP Registry; listing must be verified before treating it as live.
- Awesome Remote MCP Servers: PR #924 OPEN and mergeable; Glama connector badge and Remote MCP initialize were verified before submission.
- Smithery: separate publisher/login flow; not yet verified as listed.

## Probe rule

Do not count publication as discovery. A path is considered proven only when a service-name-free search or an external agent surfaces this capability and can reach the Remote MCP endpoint.

## Current discovery evidence

- GitHub repository search finds this repository for `store verification Japan mcp`, `physical world Japan ai agent`, and `remote mcp Japan store`.
- Glama connector listing exists and the score badge returns HTTP 200.
- Glama problem-first internal search remains UNKNOWN because the search request timed out during the probe.
- Official MCP Registry v0.4.0 is published; duplicate-version republish attempts are expected to be rejected.

## Execution distribution

- Dedicated execution API: `https://bqgfqedetmxrfpvmdfmc.supabase.co/functions/v1/japan-physical-capability-api`
- Dedicated Remote MCP: `https://bqgfqedetmxrfpvmdfmc.supabase.co/functions/v1/japan-physical-capability-mcp`
- The public MCP no longer depends on the Affiliate Factory production Supabase project after the 0.3.0 registry cutover.
- E2E evidence before cutover: MCP create/status/cancel PASS; worker claim/complete with private photo evidence PASS; signed evidence fetch HTTP 200; invalid capability tokens fail closed; private bucket direct public fetch denied; rate limit 5 accepted then 429; canary data cleaned back to zero.


## v0.4 demand probe

- Generic intake added: `request_external_execution`.
- Generic requests are tagged `request_kind=external_execution`.
- `location` is optional for generic requests.
- Optional `max_budget_jpy` records a non-binding willingness-to-pay hint.
- Physical verification remains the first verified execution path; other submitted categories are observations until manually accepted and fulfilled.
