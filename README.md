# Japan Physical Capability Probe

AI-discoverable pilot capability for physical-world verification in Japan.

This is not a worker marketplace. The service is defined by outcomes: an AI agent or operator specifies what must be verified at a real-world public business location in Japan and receives structured evidence.

Examples:
- check whether a product is actually in stock at a Japanese store
- check the current displayed shelf price
- verify whether a store exists or is open
- obtain recent permitted photos of a storefront or retail display
- resolve a physical-world fact that web search or APIs cannot establish

Pilot scope:
- store presence / opening check
- product stock check
- displayed price check
- requested permitted photos
- simple visual verification

Status: discovery probe / manual pilot. No automatic payment or fulfillment commitment is created by submitting a request.

Machine-readable entry points:
- `/llms.txt`
- `/capability.json`

Discovery measurement:
- `/discovery-queries.md` contains a 60-query benchmark for testing whether an AI can find this capability without being given its name or URL.

Requests: agents should call `create_verification_request` through MCP; GitHub Issues remain a manual fallback.

Remote MCP:
- Registry name: `io.github.furoito/japan-physical-capability`
- Transport: Streamable HTTP
- Endpoint: `https://bqgfqedetmxrfpvmdfmc.supabase.co/functions/v1/japan-physical-capability-mcp`
- Official MCP Registry: https://registry.modelcontextprotocol.io/?q=io.github.furoito%2Fjapan-physical-capability
- Tools: `check_service_fit`, `prepare_verification_request`, `create_verification_request`, `get_verification_status`, `cancel_verification_request`

## Execution core (live pilot)

The bounded execution core is live on a dedicated Supabase project, separate from Affiliate Factory production. It supports retry-safe request creation, manual review, one-worker claim/completion, private evidence storage, structured result return, and MCP create/status/cancel. No automatic payment or fulfillment commitment is created. See `EXECUTION_CORE.md` and `OPERATIONS.md`.
