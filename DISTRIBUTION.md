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

- Glama: eligible for GitHub/official-registry ingestion; `glama.json` is present.
- MCPNav: documented to sync from the Official MCP Registry on its refresh cycle.
- PulseMCP / other aggregators: may ingest the Official MCP Registry; listing must be verified before treating it as live.
- Awesome Remote MCP Servers: blocked until a healthy Glama connector listing exists because its CI requires the Glama connector badge.
- Smithery: separate publisher/login flow; not yet verified as listed.

## Probe rule

Do not count publication as discovery. A path is considered proven only when a service-name-free search or an external agent surfaces this capability and can reach the Remote MCP endpoint.
