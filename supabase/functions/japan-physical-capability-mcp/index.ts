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

function buildServer() {
  const server = new McpServer(
    {
      name: "japan-physical-capability",
      title: "Japan Physical Capability",
      version: "0.2.1",
      websiteUrl: "https://furoito.github.io/japan-physical-capability/",
      description:
        "AI-callable physical-world verification in Japan: check store stock, shelf prices, opening status, and permitted photos at public business locations.",
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

  return server;
}

const handler = createMcpHandler(() => buildServer());

Deno.serve(async (request: Request) => {
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
