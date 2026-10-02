# NT Relay public plugin checkpoint

Updated: 2026-10-03

## Public product

- Product name: **NT Relay**
- Intended website: `https://ntrelay.com/`
- Intended MCP endpoint: `https://ntrelay.com/mcp/`
- Scope: bounded external execution in Japan for AI agents, with manual review before human work.
- No automatic payment, purchase, booking, hiring, contracting, or worker dispatch.

## Hosting

The public web origin is staged on the existing ConoHa WING account under:

`public_html/ntrelay.com`

Existing Affiliate Factory OAuth files in that vhost are preserved.

Added paths:

- `/` — product landing page
- `/privacy/` — privacy policy
- `/terms/` — terms of service
- `/support/` — support page
- `/mcp/` — PHP reverse proxy to the dedicated Supabase Remote MCP

Current ConoHa origin IPv4: `157.120.209.86`.

Direct origin probe with `Host: ntrelay.com` passes. MCP `initialize` + `tools/list` through the proxy passes.

## Public HTTPS verification

Authoritative DNS is Cloudflare and both `ntrelay.com` and `www.ntrelay.com` now resolve to the ConoHa origin `157.120.209.86`.

Verified on 2026-10-03:

- TLS certificate subject: `CN=ntrelay.com`
- issuer: Let's Encrypt
- SANs: `ntrelay.com`, `www.ntrelay.com`
- `/`, `/privacy/`, `/terms/`, and `/support/` all return HTTP 200 over certificate-valid HTTPS
- `https://ntrelay.com/mcp/` MCP `initialize` returns NT Relay v0.4.3
- MCP `tools/list` returns all eight expected tools

The previous DNS/TLS blocker is closed.
## Plugin

Workspace plugin:

- backend ID: `Plugin_2c20665edaac819194924565445f5f10`
- package name: `japan-external-execution`
- display name: **NT Relay**
- package version: `0.2.0`
- discoverability: `PRIVATE`

The v0.2.0 package points at `https://ntrelay.com/mcp/` and includes:

- public listing text
- website/support/privacy/terms URLs
- logo + composer icon
- three starter prompts
- onboarding skill
- five positive review test cases
- three negative review test cases
- Japan-only initial country availability
- initial release notes

## MCP

Live dedicated Supabase MCP remains the execution backend.

Current metadata:

- title: `NT Relay`
- version: `0.4.3`
- website: `https://ntrelay.com/`
- eight tools
- `openWorldHint=false` for all tools because the MCP itself only mutates first-party/manual-review state; it does not directly contact third parties.

## OpenAI public review gate

OpenAI public plugin review still requires:

1. verified individual/business developer identity in the publishing Platform organization
2. Apps Management write permission
3. public HTTPS MCP endpoint
4. domain challenge token at `https://ntrelay.com/.well-known/openai-apps-challenge`
5. Scan Tools with no blocking findings
6. five positive + three negative test cases (prepared)
7. reviewer-accessible demo recording URL (not yet produced)
8. final policy attestations
9. OpenAI review approval
10. explicit Publish action in the submission portal

The available Plugin Creator API can create/update the workspace plugin but does not expose workspace-directory publication, public submission, or final Publish actions. Those portal actions remain a human-authenticated UI boundary.

Current observed state on 2026-10-03:

- workspace plugin release `0.2.0` is still `PRIVATE`
- its MCP configuration already points to `https://ntrelay.com/mcp/`; no release update is required for the SSL cutover
- Plugin Search does not surface NT Relay while it remains private
- `https://ntrelay.com/.well-known/openai-apps-challenge` currently returns HTTP 404; no challenge token has been issued/installed yet
- immediate Decision Frontier: publish NT Relay to the workspace directory, then run a blind discovery/tool-selection probe before investing further in global public-review work
