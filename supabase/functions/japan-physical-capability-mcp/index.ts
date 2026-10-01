const SERVER_INFO = {
  name: "japan-physical-capability",
  version: "0.1.0",
};

const SUPPORTED = [
  "store_presence_check",
  "opening_status_check",
  "retail_product_stock_check",
  "displayed_price_check",
  "permitted_photo_capture",
  "simple_visual_verification",
];

const tools = [
  {
    name: "check_service_fit",
    title: "Check Japan physical verification fit",
    description:
      "Check whether a task that requires current physical-world verification at a public business location in Japan fits this pilot capability. Use when web research or APIs cannot establish the required current fact.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Public business or retail location in Japan.",
        },
        objective: {
          type: "string",
          description: "The physical-world fact that must be verified.",
        },
        evidence_requirements: {
          type: "array",
          items: { type: "string" },
          description: "Requested evidence such as photo, displayed price, stock observation, or timestamp.",
        },
      },
      required: ["location", "objective"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        fit: { type: "string", enum: ["likely_supported", "manual_review", "not_supported"] },
        reason: { type: "string" },
        supported_capabilities: { type: "array", items: { type: "string" } },
        request_url: { type: "string" },
      },
      required: ["fit", "reason", "supported_capabilities", "request_url"],
    },
  },
  {
    name: "prepare_verification_request",
    title: "Prepare Japan physical verification request",
    description:
      "Normalize a proposed Japan physical-world verification task and return a prefilled pilot request URL. This does not purchase, submit, or commit to fulfillment.",
    inputSchema: {
      type: "object",
      properties: {
        location: { type: "string", description: "Public business or retail location in Japan." },
        objective: { type: "string", description: "What must be physically verified." },
        deadline: { type: "string", description: "Requested deadline in plain text or ISO 8601." },
        evidence_requirements: {
          type: "array",
          items: { type: "string" },
          description: "Evidence needed to consider the task complete.",
        },
        constraints: {
          type: "array",
          items: { type: "string" },
          description: "Constraints or actions the executor must not take.",
        },
      },
      required: ["location", "objective"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["prepared_for_manual_review"] },
        normalized_request: { type: "object" },
        request_url: { type: "string" },
        automatic_payment: { type: "boolean" },
        fulfillment_commitment: { type: "boolean" },
      },
      required: ["status", "normalized_request", "request_url", "automatic_payment", "fulfillment_commitment"],
    },
  },
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
      fit: "not_supported",
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
  const score = physicalSignals.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0);

  if (score >= 2) {
    return {
      fit: "likely_supported",
      reason:
        "The request appears to require a current, location-bound observation at a public business in Japan and matches the pilot scope.",
    };
  }

  return {
    fit: "manual_review",
    reason:
      "The request may fit, but the physical-world observation and public-location scope are not specific enough for automatic classification.",
  };
}

function issueUrl(args: Record<string, unknown>) {
  const evidence = Array.isArray(args.evidence_requirements)
    ? (args.evidence_requirements as string[]).map((x) => `- ${x}`).join("\n")
    : "- Not specified";
  const constraints = Array.isArray(args.constraints)
    ? (args.constraints as string[]).map((x) => `- ${x}`).join("\n")
    : "- Follow pilot safety and public-location limits";
  const body = [
    "## Location",
    String(args.location ?? ""),
    "",
    "## Objective",
    String(args.objective ?? ""),
    "",
    "## Deadline",
    String(args.deadline ?? "Not specified"),
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

function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function response(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers":
        "content-type, accept, authorization, mcp-protocol-version, mcp-method, mcp-name",
      "access-control-allow-methods": "POST, OPTIONS, GET",
      "cache-control": "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return response(null, 204);

  if (req.method === "GET") {
    return response({
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      transport: "streamable-http",
      endpoint: "/functions/v1/japan-physical-capability-mcp",
      website: "https://furoito.github.io/japan-physical-capability/",
      status: "pilot",
    });
  }

  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);

  let msg: any;
  try {
    msg = await req.json();
  } catch {
    return response(jsonRpcError(null, -32700, "Parse error"), 400);
  }

  const method = String(msg?.method ?? "");
  const modernProtocol = req.headers.get("mcp-protocol-version") === "2026-07-28";
  if (modernProtocol) {
    const headerMethod = req.headers.get("mcp-method");
    if (!headerMethod || headerMethod !== method) {
      return response(jsonRpcError(msg?.id ?? null, -32600, "Mcp-Method header must match JSON-RPC method"), 400);
    }
    if (method === "tools/call") {
      const headerName = req.headers.get("mcp-name");
      const bodyName = msg?.params?.name;
      if (!headerName || headerName !== bodyName) {
        return response(jsonRpcError(msg?.id ?? null, -32600, "Mcp-Name header must match tool name"), 400);
      }
    }
  }

  console.log(JSON.stringify({
    event: "mcp_request",
    method,
    tool: method === "tools/call" ? msg?.params?.name ?? null : null,
    protocol: req.headers.get("mcp-protocol-version") ?? msg?.params?.protocolVersion ?? null,
  }));

  if (method === "notifications/initialized") return response(null, 202);

  if (method === "initialize") {
    const requested = msg?.params?.protocolVersion;
    const protocolVersion =
      requested === "2026-07-28" || requested === "2025-11-25"
        ? requested
        : "2025-11-25";
    return response(
      jsonRpcResult(msg.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Use this pilot only for current physical-world verification at public business locations in Japan. No tool call creates payment or a fulfillment commitment.",
      }),
    );
  }

  if (method === "ping") return response(jsonRpcResult(msg.id, {}));

  if (method === "tools/list") {
    return response(jsonRpcResult(msg.id, {
      tools,
      ttlMs: 3600000,
      cacheScope: "public",
    }));
  }

  if (method === "tools/call") {
    const name = msg?.params?.name;
    const args = msg?.params?.arguments ?? {};

    if (name === "check_service_fit") {
      if (!args.location || !args.objective) {
        return response(jsonRpcError(msg.id, -32602, "location and objective are required"), 400);
      }
      const classification = classifyObjective(String(args.location), String(args.objective));
      const out = {
        ...classification,
        supported_capabilities: SUPPORTED,
        request_url: "https://github.com/furoito/japan-physical-capability/issues/new",
      };
      return response(jsonRpcResult(msg.id, {
        content: [{ type: "text", text: JSON.stringify(out) }],
        structuredContent: out,
        isError: false,
      }));
    }

    if (name === "prepare_verification_request") {
      if (!args.location || !args.objective) {
        return response(jsonRpcError(msg.id, -32602, "location and objective are required"), 400);
      }
      const classification = classifyObjective(String(args.location), String(args.objective));
      if (classification.fit === "not_supported") {
        const out = {
          status: "not_supported",
          reason: classification.reason,
        };
        return response(jsonRpcResult(msg.id, {
          content: [{ type: "text", text: JSON.stringify(out) }],
          structuredContent: out,
          isError: true,
        }));
      }
      const normalized = {
        location: String(args.location),
        objective: String(args.objective),
        deadline: args.deadline ? String(args.deadline) : null,
        evidence_requirements: Array.isArray(args.evidence_requirements) ? args.evidence_requirements : [],
        constraints: Array.isArray(args.constraints) ? args.constraints : [],
      };
      const out = {
        status: "prepared_for_manual_review",
        normalized_request: normalized,
        request_url: issueUrl(args),
        automatic_payment: false,
        fulfillment_commitment: false,
      };
      return response(jsonRpcResult(msg.id, {
        content: [{ type: "text", text: JSON.stringify(out) }],
        structuredContent: out,
        isError: false,
      }));
    }

    return response(jsonRpcError(msg.id, -32601, `Unknown tool: ${String(name)}`), 404);
  }

  return response(jsonRpcError(msg?.id ?? null, -32601, `Method not found: ${method}`), 404);
});
