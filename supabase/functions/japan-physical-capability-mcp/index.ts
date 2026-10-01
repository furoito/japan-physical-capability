import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.2.0";
import * as z from "npm:zod@4.2.0";

const SUPPORTED = [
  "store_presence_check",
  "opening_status_check",
  "retail_product_stock_check",
  "displayed_price_check",
  "permitted_photo_capture",
  "simple_visual_verification",
];

const forbiddenPatterns = [
  /private person|private individual|home address|residence/i,
  /surveillance|stalk|track a person|follow a person/i,
  /trespass|non-public|restricted area/i,
  /impersonat|signature|identity verification/i,
  /weapon|firearm|drug|controlled substance|alcohol|tobacco|vape/i,
  /illegal|deceptive|fraud/i,
];

function classifyObjective(location: string, objective: string) {
  const text = `${location}\n${objective}`;

  if (forbiddenPatterns.some((pattern) => pattern.test(text))) {
    return {
      fit: "not_supported" as const,
      reason:
        "This pilot does not support private-person surveillance, non-public access, regulated purchases, impersonation, or unsafe/illegal/deceptive requests.",
    };
  }

  const physicalSignals = [
    /store|shop|retail|business|location|店舗|店|売場/i,
    /stock|inventory|availability|在庫/i,
    /price|shelf|displayed|価格|値段/i,
    /open|opening|営業/i,
    /photo|photograph|写真/i,
    /verify|check|confirm|確認|検証/i,
  ];
  const score = physicalSignals.reduce((n, pattern) => n + (pattern.test(text) ? 1 : 0), 0);

  if (score >= 2) {
    return {
      fit: "likely_supported" as const,
      reason:
        "The request appears to require a current, location-bound observation at a public business in Japan and matches the pilot scope.",
    };
  }

  return {
    fit: "manual_review" as const,
    reason:
      "The request may fit, but the physical-world observation and public-location scope are not specific enough for automatic classification.",
  };
}

function issueUrl(args: {
  location: string;
  objective: string;
  deadline?: string;
  evidence_requirements?: string[];
  constraints?: string[];
}) {
  const evidence = args.evidence_requirements?.length
    ? args.evidence_requirements.map((x) => `- ${x}`).join("\n")
    : "- Not specified";
  const constraints = args.constraints?.length
    ? args.constraints.map((x) => `- ${x}`).join("\n")
    : "- Follow pilot safety and public-location limits";

  const body = [
    "## Location",
    args.location,
    "",
    "## Objective",
    args.objective,
    "",
    "## Deadline",
    args.deadline ?? "Not specified",
    "",
    "## Evidence required",
    evidence,
    "",
    "## Constraints",
    constraints,
    "",
    "> Prepared by the public MCP pilot. Submission does not create a purchase or fulfillment commitment.",
  ].join("\n");

  const params = new URLSearchParams({
    title: "[REQUEST] Physical verification in Japan",
    body,
  });
  return `https://github.com/furoito/japan-physical-capability/issues/new?${params.toString()}`;
}


const EXECUTION_API =
  "https://bqgfqedetmxrfpvmdfmc.supabase.co/functions/v1/japan-physical-capability-api";

async function executionApi(path: string, init: RequestInit = {}) {
  const response = await fetch(`${EXECUTION_API}${path}`, init);
  const payload = await response.json().catch(() => ({ error: "invalid_api_response" }));
  if (!response.ok) {
    const error = new Error(`${response.status}:${payload.error ?? "request_failed"}`);
    (error as any).status = response.status;
    (error as any).payload = payload;
    throw error;
  }
  return payload;
}

function buildServer() {
  const server = new McpServer(
    {
      name: "japan-physical-capability",
      title: "Japan External Execution",
      version: "0.4.0",
      websiteUrl: "https://furoito.github.io/japan-physical-capability/",
      description:
        "AI-callable external execution in Japan: submit bounded real-world tasks for manual review and human execution.",
    },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    "check_service_fit",
    {
      title: "Check Japan physical verification fit",
      description:
        "Use when an AI needs someone on the ground in Japan to verify a current physical-world fact such as store stock, shelf price, opening status, or permitted photos, after web research or APIs are insufficient.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        location: z.string().min(1).describe("Public business or retail location in Japan."),
        objective: z.string().min(1).describe("The physical-world fact that must be verified."),
        evidence_requirements: z
          .array(z.string())
          .optional()
          .describe("Requested evidence such as photo, displayed price, stock observation, or timestamp."),
      }),
    },
    async ({ location, objective }) => {
      const classification = classifyObjective(location, objective);
      const output = {
        ...classification,
        supported_capabilities: SUPPORTED,
        request_url: "https://github.com/furoito/japan-physical-capability/issues/new",
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
        isError: false,
      };
    },
  );

  server.registerTool(
    "prepare_verification_request",
    {
      title: "Prepare Japan physical verification request",
      description:
        "Prepare a Japan on-site verification request for a human-executed store check. Returns a prefilled manual-review URL only; it does not purchase, submit, hire, pay, or create a fulfillment commitment.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        location: z.string().min(1).describe("Public business or retail location in Japan."),
        objective: z.string().min(1).describe("What must be physically verified."),
        deadline: z.string().optional().describe("Requested deadline in plain text or ISO 8601."),
        evidence_requirements: z
          .array(z.string())
          .optional()
          .describe("Evidence needed to consider the task complete."),
        constraints: z
          .array(z.string())
          .optional()
          .describe("Constraints or actions the executor must not take."),
      }),
    },
    async (args) => {
      const classification = classifyObjective(args.location, args.objective);
      if (classification.fit === "not_supported") {
        const output = {
          status: "not_supported",
          reason: classification.reason,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }

      const normalized_request = {
        location: args.location,
        objective: args.objective,
        deadline: args.deadline ?? null,
        evidence_requirements: args.evidence_requirements ?? [],
        constraints: args.constraints ?? [],
      };
      const output = {
        status: "prepared_for_manual_review",
        normalized_request,
        request_url: issueUrl(args),
        automatic_payment: false,
        fulfillment_commitment: false,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
        isError: false,
      };
    },
  );


  server.registerTool(
    "create_verification_request",
    {
      title: "Create Japan physical verification request",
      description:
        "Create a retry-safe manual-review physical verification request in Japan. Reuse the same idempotency_key for the same logical request. No payment, worker hire, or fulfillment commitment is created automatically.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        location: z.string().min(2).max(500),
        objective: z.string().min(3).max(4000),
        deadline: z.string().datetime().optional(),
        evidence_requirements: z.array(z.string().max(500)).max(20).optional(),
        constraints: z.array(z.string().max(500)).max(20).optional(),
        idempotency_key: z.string().min(8).max(200).describe("Stable key for this logical request. Reuse the same key when retrying create after a lost response."),
      }),
    },
    async (input) => {
      try {
        const result = await executionApi("/requests", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(input.idempotency_key
              ? { "x-idempotency-key": input.idempotency_key }
              : {}),
          },
          body: JSON.stringify(input),
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        };
      } catch (error) {
        const output = {
          error: "execution_api_request_failed",
          detail: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_verification_status",
    {
      title: "Get Japan physical verification status",
      description:
        "Read the current request state and, when completed, receive structured observations and temporary signed evidence URLs.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        request_id: z.string().uuid(),
        status_token: z.string().min(20),
      }),
    },
    async ({ request_id, status_token }) => {
      try {
        const result = await executionApi(
          `/requests/${encodeURIComponent(request_id)}`,
          { headers: { authorization: `Bearer ${status_token}` } },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        };
      } catch (error) {
        const output = {
          error: "execution_api_status_failed",
          detail: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "cancel_verification_request",
    {
      title: "Cancel Japan physical verification request",
      description:
        "Cancel a request only while it is pending manual review or open. Claimed or completed work cannot be cancelled through this tool.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        request_id: z.string().uuid(),
        status_token: z.string().min(20),
      }),
    },
    async ({ request_id, status_token }) => {
      try {
        const result = await executionApi(
          `/requests/${encodeURIComponent(request_id)}/cancel`,
          {
            method: "POST",
            headers: { authorization: `Bearer ${status_token}` },
          },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        };
      } catch (error) {
        const output = {
          error: "execution_api_cancel_failed",
          detail: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }
    },
  );


  server.registerTool(
    "request_external_execution",
    {
      title: "Request external execution in Japan",
      description:
        "Submit a bounded task that an AI cannot complete itself, such as an on-site check, phone inquiry, pickup/drop-off, shipping/return step, or other human action in Japan. Manual review only: this does not spend money, hire anyone, or promise fulfillment.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        objective: z.string().min(3).max(4000).describe("The outcome the AI needs from the external world."),
        location: z.string().min(2).max(500).optional().describe("Optional place, business, or area in Japan when location matters."),
        deadline: z.string().datetime().optional(),
        max_budget_jpy: z.number().int().nonnegative().optional().describe("Optional non-binding maximum budget hint in JPY. No automatic payment occurs."),
        evidence_requirements: z.array(z.string().max(500)).max(20).optional(),
        constraints: z.array(z.string().max(500)).max(20).optional(),
        idempotency_key: z.string().min(8).max(200).describe("Stable key for this logical request. Reuse it if create must be retried."),
      }),
    },
    async (input) => {
      try {
        const payload = { ...input, request_kind: "external_execution" };
        const result = await executionApi("/requests", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-idempotency-key": input.idempotency_key,
          },
          body: JSON.stringify(payload),
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        };
      } catch (error) {
        const output = {
          error: "external_execution_request_failed",
          detail: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_external_execution_status",
    {
      title: "Get external execution status",
      description: "Read the current state and any completed result for an external-execution request.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        request_id: z.string().uuid(),
        status_token: z.string().min(20),
      }),
    },
    async ({ request_id, status_token }) => {
      try {
        const result = await executionApi(
          `/requests/${encodeURIComponent(request_id)}`,
          { headers: { authorization: `Bearer ${status_token}` } },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        };
      } catch (error) {
        const output = {
          error: "external_execution_status_failed",
          detail: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "cancel_external_execution_request",
    {
      title: "Cancel external execution request",
      description: "Cancel an external-execution request while it is still pending review or open.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        request_id: z.string().uuid(),
        status_token: z.string().min(20),
      }),
    },
    async ({ request_id, status_token }) => {
      try {
        const result = await executionApi(
          `/requests/${encodeURIComponent(request_id)}/cancel`,
          {
            method: "POST",
            headers: { authorization: `Bearer ${status_token}` },
          },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        };
      } catch (error) {
        const output = {
          error: "external_execution_cancel_failed",
          detail: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }
    },
  );


  server.registerTool(
    "request_external_execution",
    {
      title: "Request external execution in Japan",
      description:
        "Use when an AI cannot complete a task digitally and needs a human or real-world actor in Japan. Submit the objective without preselecting a service category. Requests are manually reviewed; no payment, purchase, hire, contract, or fulfillment commitment happens automatically.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        objective: z.string().min(3).max(4000).describe("The outcome the agent needs from the external world."),
        location: z.string().min(2).max(500).optional().describe("Optional place or geographic constraint. Omit when the task is not location-bound."),
        max_budget: z.object({
          amount: z.number().nonnegative().max(1_000_000_000_000),
          currency: z.string().regex(/^[A-Za-z]{3}$/).describe("ISO 4217-style three-letter currency code, e.g. JPY."),
        }).optional().describe("Optional maximum budget. This is metadata only and does not authorize spending."),
        deadline: z.string().datetime().optional(),
        evidence_requirements: z.array(z.string().max(500)).max(20).optional(),
        constraints: z.array(z.string().max(500)).max(20).optional(),
        idempotency_key: z.string().min(8).max(200).describe("Stable key for this logical request. Reuse it when retrying after a lost response."),
      }),
    },
    async (input) => {
      const text = `${input.location ?? ""}\n${input.objective}`;
      if (forbiddenPatterns.some((pattern) => pattern.test(text))) {
        const output = {
          status: "not_supported",
          reason:
            "This pilot does not accept private-person surveillance, non-public access, regulated purchases, impersonation, or unsafe/illegal/deceptive requests.",
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }

      try {
        const result = await executionApi("/requests", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-idempotency-key": input.idempotency_key,
          },
          body: JSON.stringify({
            request_kind: "external_execution",
            objective: input.objective,
            location: input.location,
            max_budget_amount: input.max_budget?.amount,
            max_budget_currency: input.max_budget?.currency?.toUpperCase(),
            deadline: input.deadline,
            evidence_requirements: input.evidence_requirements,
            constraints: input.constraints,
          }),
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        };
      } catch (error) {
        const output = {
          error: "external_execution_request_failed",
          detail: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_external_execution_status",
    {
      title: "Get external execution status",
      description:
        "Read the current manual-review/execution state and, when completed, receive structured results and temporary signed evidence URLs.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        request_id: z.string().uuid(),
        status_token: z.string().min(20),
      }),
    },
    async ({ request_id, status_token }) => {
      try {
        const result = await executionApi(
          `/requests/${encodeURIComponent(request_id)}`,
          { headers: { authorization: `Bearer ${status_token}` } },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        };
      } catch (error) {
        const output = {
          error: "external_execution_status_failed",
          detail: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "cancel_external_execution_request",
    {
      title: "Cancel external execution request",
      description:
        "Cancel a generic external-execution request while it is still pending review or open.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        request_id: z.string().uuid(),
        status_token: z.string().min(20),
      }),
    },
    async ({ request_id, status_token }) => {
      try {
        const result = await executionApi(
          `/requests/${encodeURIComponent(request_id)}/cancel`,
          {
            method: "POST",
            headers: { authorization: `Bearer ${status_token}` },
          },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        };
      } catch (error) {
        const output = {
          error: "external_execution_cancel_failed",
          detail: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
          structuredContent: output,
          isError: true,
        };
      }
    },
  );

  return server;
}

const handler = createMcpHandler(() => buildServer());

Deno.serve(async (request: Request) => {
  if (request.method === "GET") {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/health")) {
      return Response.json({
        ok: true,
        service: "japan-physical-capability-mcp",
        version: "0.4.0",
        tools: [
          "check_service_fit",
          "prepare_verification_request",
          "create_verification_request",
          "get_verification_status",
          "cancel_verification_request",
          "request_external_execution",
          "get_external_execution_status",
          "cancel_external_execution_request"
        ]
      });
    }
  }
  try {
    if (request.method === "POST") {
      const body = await request.clone().json().catch(() => null) as any;
      console.log(JSON.stringify({
        event: "japan_physical_capability_mcp",
        method: body?.method ?? null,
        tool: body?.method === "tools/call" ? body?.params?.name ?? null : null,
        protocol: request.headers.get("mcp-protocol-version") ?? body?.params?._meta?.["io.modelcontextprotocol/protocolVersion"] ?? null,
      }));
    }
  } catch {
    // Observability must never block the MCP response path.
  }

  return handler.fetch(request);
});
