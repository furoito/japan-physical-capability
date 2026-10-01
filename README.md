# Japan External Execution Probe

AI-discoverable manual-review intake for external execution in Japan.

The current decision frontier is no longer “is store-stock checking frequent enough?” It is: **what external work do AI agents naturally try to outsource when they cannot complete the next step digitally?**

## Generic intake

The public Remote MCP exposes:

- `request_external_execution`
- `get_external_execution_status`
- `cancel_external_execution_request`

The create tool accepts a free-form objective, optional location, optional maximum budget metadata, deadline, evidence requirements, constraints, and a retry-safe idempotency key.

Requests enter `pending_review`. No payment, purchase, worker hire, contract, or fulfillment commitment is created automatically.

## Validated specialized path

Physical verification in Japan remains the first validated execution path:

- store presence / opening checks
- product stock checks
- displayed price checks
- permitted non-sensitive photos
- simple visual verification

Existing verification tools remain available.

## Distribution

- Registry name: `io.github.furoito/japan-physical-capability`
- Transport: Streamable HTTP
- Endpoint: `https://bqgfqedetmxrfpvmdfmc.supabase.co/functions/v1/japan-physical-capability-mcp`
- Official MCP Registry: https://registry.modelcontextprotocol.io/?q=io.github.furoito%2Fjapan-physical-capability

## Execution core

The bounded execution core runs on a dedicated Supabase project, separate from Affiliate Factory production. Requests are retry-safe, manually reviewed, capability-token mediated, and can return private signed evidence when completed.
