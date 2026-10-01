# Distribution status

Canonical distribution checkpoint for the Japan Physical Capability discovery probe.

## Live

- Official MCP Registry
  - name: `io.github.furoito/japan-physical-capability`
  - version: `0.2.1`
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
- Official MCP Registry 0.2.1 publish workflow completed successfully.
