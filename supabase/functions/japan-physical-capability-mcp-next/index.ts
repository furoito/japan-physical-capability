// NEXT / NOT LIVE. Activate only after the dedicated execution API is deployed and verified.
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.2.0";
import * as z from "npm:zod@4.2.0";

function apiBase() {
  const value = Deno.env.get("CAPABILITY_EXECUTION_API_BASE");
  if (!value) throw new Error("CAPABILITY_EXECUTION_API_BASE is not configured");
  return value.replace(/\/$/, "");
}

async function api(path, init = {}) {
  const response = await fetch(`${apiBase()}${path}`, init);
  const payload = await response.json().catch(() => ({ error: "invalid_api_response" }));
  if (!response.ok) throw new Error(`${response.status}:${payload.error ?? "request_failed"}`);
  return payload;
}

function buildServer() {
  const server = new McpServer({
    name: "japan-physical-capability",
    title: "Japan Physical Capability",
    version: "0.3.0-next",
    websiteUrl: "https://furoito.github.io/japan-physical-capability/",
    description: "Japan store verification for AI agents: stock, shelf price, opening status, and permitted photos.",
  }, { capabilities: { tools: {} } });

  server.registerTool("create_verification_request", {
    title: "Create Japan physical verification request",
    description: "Create a manual-review physical verification request in Japan. No payment or fulfillment commitment is created automatically.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: z.object({
      location: z.string().min(2).max(500),
      objective: z.string().min(3).max(4000),
      deadline: z.string().datetime().optional(),
      evidence_requirements: z.array(z.string().max(500)).max(20).optional(),
      constraints: z.array(z.string().max(500)).max(20).optional(),
      idempotency_key: z.string().min(8).max(200).optional(),
    }),
  }, async (input) => {
    const result = await api("/requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(input.idempotency_key ? { "x-idempotency-key": input.idempotency_key } : {}),
      },
      body: JSON.stringify(input),
    });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  });

  server.registerTool("get_verification_status", {
    title: "Get Japan physical verification status",
    description: "Read the current request state and, when completed, receive structured observations and temporary evidence URLs.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: z.object({ request_id: z.string().uuid(), status_token: z.string().min(20) }),
  }, async ({ request_id, status_token }) => {
    const result = await api(`/requests/${encodeURIComponent(request_id)}`, {
      headers: { authorization: `Bearer ${status_token}` },
    });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  });

  server.registerTool("cancel_verification_request", {
    title: "Cancel Japan physical verification request",
    description: "Cancel a request only while it is pending manual review or open. Claimed/completed work cannot be cancelled through this tool.",
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: z.object({ request_id: z.string().uuid(), status_token: z.string().min(20) }),
  }, async ({ request_id, status_token }) => {
    const result = await api(`/requests/${encodeURIComponent(request_id)}/cancel`, {
      method: "POST",
      headers: { authorization: `Bearer ${status_token}` },
    });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  });

  return server;
}

const handler = createMcpHandler(() => buildServer());
Deno.serve((req) => handler.fetch(req));
