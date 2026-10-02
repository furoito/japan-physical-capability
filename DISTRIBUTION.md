# Distribution status

Canonical distribution checkpoint for the Japan Physical Capability discovery probe.

## Live

- Official MCP Registry
  - name: `io.github.furoito/japan-physical-capability`
  - version: `0.4.1`
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
- Official MCP Registry v0.4.1 is published and marked latest.
- Within the first few hours, multiple independent MCP crawlers/indexers reached the endpoint, including Muse Directory, MCPHub, Tendle, agent-index-prober, Histor, GlideMcpIndex, MCP Observatory, mcp.market, and BrickBlueBot.
- External discovery progressed beyond metadata: BrickBlueBot invoked capability tools. No natural `create_verification_request` was observed before the generic intake pivot.
- Interpretation: discovery is demonstrated; the active uncertainty is what external work agents actually try to submit, not whether the endpoint can be found.

## Execution distribution

- Dedicated execution API: `https://bqgfqedetmxrfpvmdfmc.supabase.co/functions/v1/japan-physical-capability-api`
- Dedicated Remote MCP: `https://bqgfqedetmxrfpvmdfmc.supabase.co/functions/v1/japan-physical-capability-mcp`
- The public MCP no longer depends on the Affiliate Factory production Supabase project after the 0.3.0 registry cutover.
- E2E evidence before cutover: MCP create/status/cancel PASS; worker claim/complete with private photo evidence PASS; signed evidence fetch HTTP 200; invalid capability tokens fail closed; private bucket direct public fetch denied; rate limit 5 accepted then 429; canary data cleaned back to zero.


## v0.4.1 demand probe

- Generic intake added: `request_external_execution`.
- Generic requests are tagged `request_kind=external_execution`.
- `location` is optional for generic requests.
- Optional `max_budget_jpy` records a non-binding willingness-to-pay hint.
- Physical verification remains the first verified execution path; other submitted categories are observations until manually accepted and fulfilled.

- Generic E2E verified: `request_external_execution` with no location and `max_budget_jpy=3000` -> `pending_review` -> status read -> cancel. Canary cleaned.
- Generic intake is now the active Decision Frontier: observe the first natural `request_kind=external_execution` request and its objective/budget rather than guessing another service category.

## Agent workflow injection probe — 2026-10-02

- Codex CLI was connected directly to the public Remote MCP and given a realistic task that required current real-world verification.
- The prompt did not name this service, MCP server, or any tool.
- Codex searched the web first, detected the remaining real-world information gap, and independently selected `request_external_execution`.
- A controlled `request_kind=external_execution` request reached `pending_review` with `max_budget_jpy=0`; no payment, booking, purchase, or worker dispatch occurred.
- Codex also read the request back through `get_external_execution_status`.
- The synthetic request was cancelled and deleted after verification so it is not counted as market demand.
- This proves workflow-level tool selection when the capability is already available to the agent. It does **not** prove organic market demand or organic discovery-to-conversion.
- A timezone-offset validation bug in `deadline` was found during the probe and fixed in MCP v0.4.2.
