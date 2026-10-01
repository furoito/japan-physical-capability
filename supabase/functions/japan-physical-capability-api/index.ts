import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const BUCKET = "capability-evidence";
const ALLOWED_ORIGINS = new Set([
  "https://furoito.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);
const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REQUESTS_PER_HOUR = 5;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function secretKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    const keys = JSON.parse(modern);
    if (keys.default) return keys.default;
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("SUPABASE secret key is unavailable");
  return legacy;
}

function db() {
  return createClient(Deno.env.get("SUPABASE_URL"), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function cors(req) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://furoito.github.io",
    "access-control-allow-headers": "content-type, authorization, x-operator-key, x-idempotency-key",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "vary": "origin",
  };
}

function json(req, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(req), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function newToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function tokenHash(value) {
  // Requester and worker tokens are 256-bit random bearer capabilities.
  // A one-way SHA-256 digest is sufficient for at-rest comparison.
  return sha256(value);
}

async function privateFingerprintHash(value) {
  // Low-entropy client fingerprints need a server-only keyed input.
  // Reuse the project's server secret without exposing or persisting it.
  return sha256(`${secretKey()}\n${value}`);
}

function bearer(req, scheme = "Bearer") {
  const raw = req.headers.get("authorization") ?? "";
  const prefix = `${scheme} `;
  return raw.startsWith(prefix) ? raw.slice(prefix.length).trim() : null;
}

function cleanString(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanArray(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((x) => cleanString(x, 500)).filter(Boolean);
}

function classify(location, objective) {
  const text = `${location}\n${objective}`;
  const forbidden = [
    /private person|private individual|home address|residence/i,
    /surveillance|stalk|track a person|follow a person/i,
    /trespass|non-public|restricted area/i,
    /impersonat|signature|identity verification/i,
    /weapon|firearm|controlled substance|illegal drug|alcohol|tobacco|vape/i,
    /fraud|deceptive|illegal/i,
  ];
  if (forbidden.some((p) => p.test(text))) return { allowed: false, reason: "request_outside_pilot_safety_scope" };
  return { allowed: true, reason: "manual_review_required" };
}

function clientFingerprint(req) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "unknown";
  return `${forwarded}\n${ua.slice(0, 240)}`;
}

async function addEvent(client, jobId, eventType, actorType, payload = {}) {
  const { error } = await client.from("capability_job_events").insert({
    job_id: jobId,
    event_type: eventType,
    actor_type: actorType,
    payload,
  });
  if (error) console.error("event_insert_failed", error.message);
}

async function getJobByRequesterToken(client, id, token) {
  const tokenHash = await tokenHash(token);
  const { data, error } = await client.from("capability_jobs").select("*").eq("id", id).eq("requester_token_hash", tokenHash).maybeSingle();
  if (error) throw error;
  return data;
}

async function getJobByWorkerToken(client, id, token) {
  const tokenHash = await tokenHash(token);
  const { data, error } = await client.from("capability_jobs").select("*").eq("id", id).eq("worker_token_hash", tokenHash).maybeSingle();
  if (error) throw error;
  return data;
}

async function signedEvidence(client, jobId) {
  const { data: rows, error } = await client.from("capability_evidence")
    .select("storage_path,media_type,caption,created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const evidence = [];
  for (const row of rows ?? []) {
    const { data, error: signError } = await client.storage.from(BUCKET).createSignedUrl(row.storage_path, 3600);
    if (signError) continue;
    evidence.push({ media_type: row.media_type, caption: row.caption, url: data.signedUrl, expires_in_seconds: 3600 });
  }
  return evidence;
}

async function createRequest(req) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json(req, { error: "invalid_json" }, 400);

  const location = cleanString(body.location, 500);
  const objective = cleanString(body.objective, 4000);
  if (location.length < 2 || objective.length < 3) return json(req, { error: "location_and_objective_required" }, 400);

  const gate = classify(location, objective);
  if (!gate.allowed) return json(req, { error: gate.reason }, 400);

  const deadlineRaw = cleanString(body.deadline, 100);
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
  if (deadline && Number.isNaN(deadline.getTime())) return json(req, { error: "invalid_deadline" }, 400);

  const client = db();
  const sourceFingerprint = await privateFingerprintHash(clientFingerprint(req));
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error: countError } = await client.from("capability_jobs")
    .select("id", { count: "exact", head: true })
    .eq("source_fingerprint", sourceFingerprint)
    .gte("created_at", since);
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) return json(req, { error: "rate_limited" }, 429);

  const requesterToken = newToken();
  const requesterTokenHash = await tokenHash(requesterToken);
  const idemRaw = cleanString(req.headers.get("x-idempotency-key") ?? body.idempotency_key, 200);
  const idempotencyHash = idemRaw ? await tokenHash(idemRaw) : null;

  if (idempotencyHash) {
    const { data: existing } = await client.from("capability_jobs").select("id,status,created_at").eq("idempotency_key_hash", idempotencyHash).maybeSingle();
    if (existing) return json(req, { error: "idempotency_key_already_used", request_id: existing.id, status: existing.status }, 409);
  }

  const { data: job, error } = await client.from("capability_jobs").insert({
    requester_token_hash: requesterTokenHash,
    idempotency_key_hash: idempotencyHash,
    source_fingerprint: sourceFingerprint,
    location,
    objective,
    deadline: deadline?.toISOString() ?? null,
    evidence_requirements: cleanArray(body.evidence_requirements),
    constraints: cleanArray(body.constraints),
  }).select("id,status,created_at").single();
  if (error) throw error;

  await addEvent(client, job.id, "request_created", "requester", { source: "public_api" });
  return json(req, {
    request_id: job.id,
    status: job.status,
    status_token: requesterToken,
    created_at: job.created_at,
    fulfillment_commitment: false,
    automatic_payment: false,
  }, 201);
}

async function requestStatus(req, id) {
  const token = bearer(req);
  if (!token) return json(req, { error: "requester_token_required" }, 401);
  const client = db();
  const job = await getJobByRequesterToken(client, id, token);
  if (!job) return json(req, { error: "not_found" }, 404);

  const result = {
    request_id: job.id,
    status: job.status,
    location: job.location,
    objective: job.objective,
    deadline: job.deadline,
    evidence_requirements: job.evidence_requirements,
    constraints: job.constraints,
    created_at: job.created_at,
    updated_at: job.updated_at,
    result_summary: job.result_summary,
    observations: job.result_payload,
    evidence: [],
  };
  if (job.status === "completed") result.evidence = await signedEvidence(client, id);
  return json(req, result);
}

async function cancelRequest(req, id) {
  const token = bearer(req);
  if (!token) return json(req, { error: "requester_token_required" }, 401);
  const client = db();
  const job = await getJobByRequesterToken(client, id, token);
  if (!job) return json(req, { error: "not_found" }, 404);
  if (!["pending_review", "open"].includes(job.status)) return json(req, { error: "cannot_cancel_in_current_state", status: job.status }, 409);
  const now = new Date().toISOString();
  const { error } = await client.from("capability_jobs").update({ status: "cancelled", cancelled_at: now, updated_at: now }).eq("id", id).eq("status", job.status);
  if (error) throw error;
  await addEvent(client, id, "request_cancelled", "requester");
  return json(req, { request_id: id, status: "cancelled" });
}

function operatorAuthorized(req) {
  const expected = Deno.env.get("CAPABILITY_OPERATOR_KEY");
  const actual = req.headers.get("x-operator-key") ?? "";
  return Boolean(expected && actual && expected === actual);
}

async function operatorList(req, url) {
  if (!operatorAuthorized(req)) return json(req, { error: "operator_unauthorized" }, 401);
  const requested = url.searchParams.get("status") ?? "pending_review";
  const allowed = new Set(["pending_review", "open", "claimed", "completed", "rejected", "cancelled"]);
  if (!allowed.has(requested)) return json(req, { error: "invalid_status" }, 400);
  const client = db();
  const { data, error } = await client.from("capability_jobs")
    .select("id,status,location,objective,deadline,evidence_requirements,constraints,created_at,updated_at")
    .eq("status", requested)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  return json(req, { jobs: data ?? [] });
}

async function operatorApprove(req, id) {
  if (!operatorAuthorized(req)) return json(req, { error: "operator_unauthorized" }, 401);
  const client = db();
  const { data: current, error: readError } = await client.from("capability_jobs").select("id,status").eq("id", id).maybeSingle();
  if (readError) throw readError;
  if (!current) return json(req, { error: "not_found" }, 404);
  if (current.status !== "pending_review") return json(req, { error: "not_pending_review", status: current.status }, 409);

  const workerToken = newToken();
  const workerTokenHash = await tokenHash(workerToken);
  const now = new Date().toISOString();
  const { error } = await client.from("capability_jobs").update({
    status: "open",
    worker_token_hash: workerTokenHash,
    approved_at: now,
    updated_at: now,
  }).eq("id", id).eq("status", "pending_review");
  if (error) throw error;
  await addEvent(client, id, "request_approved", "operator");

  const workerBase = Deno.env.get("CAPABILITY_WORKER_URL") ?? "https://furoito.github.io/japan-physical-capability/pilot/worker.html";
  return json(req, {
    request_id: id,
    status: "open",
    worker_url: `${workerBase}?job=${encodeURIComponent(id)}#token=${encodeURIComponent(workerToken)}`,
  });
}

async function operatorReject(req, id) {
  if (!operatorAuthorized(req)) return json(req, { error: "operator_unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const reason = cleanString(body.reason, 1000) || "manual_review_rejected";
  const client = db();
  const now = new Date().toISOString();
  const { data, error } = await client.from("capability_jobs").update({
    status: "rejected",
    result_summary: reason,
    updated_at: now,
  }).eq("id", id).eq("status", "pending_review").select("id").maybeSingle();
  if (error) throw error;
  if (!data) return json(req, { error: "not_pending_review" }, 409);
  await addEvent(client, id, "request_rejected", "operator", { reason });
  return json(req, { request_id: id, status: "rejected", reason });
}

async function workerJob(req, id) {
  const token = bearer(req, "Worker");
  if (!token) return json(req, { error: "worker_token_required" }, 401);
  const client = db();
  const job = await getJobByWorkerToken(client, id, token);
  if (!job) return json(req, { error: "not_found" }, 404);
  return json(req, {
    request_id: job.id,
    status: job.status,
    location: job.location,
    objective: job.objective,
    deadline: job.deadline,
    evidence_requirements: job.evidence_requirements,
    constraints: job.constraints,
  });
}

async function workerClaim(req, id) {
  const token = bearer(req, "Worker");
  if (!token) return json(req, { error: "worker_token_required" }, 401);
  const client = db();
  const job = await getJobByWorkerToken(client, id, token);
  if (!job) return json(req, { error: "not_found" }, 404);
  if (job.status === "claimed") return json(req, { request_id: id, status: "claimed" });
  if (job.status !== "open") return json(req, { error: "not_open", status: job.status }, 409);
  const now = new Date().toISOString();
  const { data, error } = await client.from("capability_jobs").update({ status: "claimed", claimed_at: now, updated_at: now })
    .eq("id", id).eq("status", "open").select("id").maybeSingle();
  if (error) throw error;
  if (!data) return json(req, { error: "claim_conflict" }, 409);
  await addEvent(client, id, "job_claimed", "worker");
  return json(req, { request_id: id, status: "claimed" });
}

function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "evidence";
}

async function workerComplete(req, id) {
  const token = bearer(req, "Worker");
  if (!token) return json(req, { error: "worker_token_required" }, 401);
  const client = db();
  const job = await getJobByWorkerToken(client, id, token);
  if (!job) return json(req, { error: "not_found" }, 404);
  if (job.status !== "claimed") return json(req, { error: "not_claimed", status: job.status }, 409);

  const form = await req.formData();
  const summary = cleanString(form.get("summary"), 4000);
  if (!summary) return json(req, { error: "summary_required" }, 400);
  let observations = {};
  const rawObservations = cleanString(form.get("observations"), 20000);
  if (rawObservations) {
    try { observations = JSON.parse(rawObservations); }
    catch { return json(req, { error: "observations_must_be_json" }, 400); }
  }

  const files = form.getAll("evidence").filter((x) => x instanceof File && x.size > 0);
  if (files.length > MAX_FILES) return json(req, { error: "too_many_files", max_files: MAX_FILES }, 400);

  const uploaded = [];
  for (const file of files) {
    if (!IMAGE_TYPES.has(file.type)) return json(req, { error: "unsupported_media_type", media_type: file.type }, 400);
    if (file.size > MAX_FILE_BYTES) return json(req, { error: "file_too_large", max_bytes: MAX_FILE_BYTES }, 400);
    const evidenceId = crypto.randomUUID();
    const storagePath = `${id}/${evidenceId}-${safeFilename(file.name)}`;
    const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw uploadError;
    uploaded.push({ storage_path: storagePath, media_type: file.type, caption: null });
  }

  if (uploaded.length) {
    const { error: evidenceError } = await client.from("capability_evidence").insert(uploaded.map((x) => ({ job_id: id, ...x })));
    if (evidenceError) throw evidenceError;
  }

  const now = new Date().toISOString();
  const { data, error } = await client.from("capability_jobs").update({
    status: "completed",
    result_summary: summary,
    result_payload: observations,
    completed_at: now,
    updated_at: now,
  }).eq("id", id).eq("status", "claimed").select("id").maybeSingle();
  if (error) throw error;
  if (!data) return json(req, { error: "completion_conflict" }, 409);
  await addEvent(client, id, "job_completed", "worker", { evidence_count: uploaded.length });
  return json(req, { request_id: id, status: "completed", evidence_count: uploaded.length });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const fnIndex = parts.lastIndexOf("japan-physical-capability-api");
    const path = fnIndex >= 0 ? parts.slice(fnIndex + 1) : parts;

    if (req.method === "POST" && path.length === 1 && path[0] === "requests") return await createRequest(req);
    if (path.length === 2 && path[0] === "requests" && req.method === "GET") return await requestStatus(req, path[1]);
    if (path.length === 3 && path[0] === "requests" && path[2] === "cancel" && req.method === "POST") return await cancelRequest(req, path[1]);

    if (path.length === 2 && path[0] === "operator" && path[1] === "jobs" && req.method === "GET") return await operatorList(req, url);
    if (path.length === 4 && path[0] === "operator" && path[1] === "jobs" && path[3] === "approve" && req.method === "POST") return await operatorApprove(req, path[2]);
    if (path.length === 4 && path[0] === "operator" && path[1] === "jobs" && path[3] === "reject" && req.method === "POST") return await operatorReject(req, path[2]);

    if (path.length === 3 && path[0] === "worker" && path[1] === "jobs" && req.method === "GET") return await workerJob(req, path[2]);
    if (path.length === 4 && path[0] === "worker" && path[1] === "jobs" && path[3] === "claim" && req.method === "POST") return await workerClaim(req, path[2]);
    if (path.length === 4 && path[0] === "worker" && path[1] === "jobs" && path[3] === "complete" && req.method === "POST") return await workerComplete(req, path[2]);

    return json(req, { error: "not_found" }, 404);
  } catch (error) {
    console.error("capability_api_error", error);
    return json(req, { error: "internal_error" }, 500);
  }
});
