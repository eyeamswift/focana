const LOOPS_SEND_EVENT_URL = "https://app.loops.so/api/v1/events/send";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

type Primitive = string | number | boolean | null;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" ? token || "" : "";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 240) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanEmail(value: unknown) {
  const email = cleanString(value, 320).toLowerCase();
  return email.includes("@") ? email : "";
}

function cleanPrimitiveMap(value: unknown, reservedKeys = new Set<string>()) {
  if (!isPlainRecord(value)) return {};

  return Object.entries(value).reduce<Record<string, Primitive>>(
    (accumulator, [key, rawValue]) => {
      const cleanKey = cleanString(key, 80);
      if (!cleanKey || reservedKeys.has(cleanKey)) return accumulator;

      if (
        rawValue === null ||
        ["string", "number", "boolean"].includes(typeof rawValue)
      ) {
        accumulator[cleanKey] = rawValue as Primitive;
      }

      return accumulator;
    },
    {},
  );
}

function cleanMailingLists(value: unknown) {
  if (!isPlainRecord(value)) return {};

  return Object.entries(value).reduce<Record<string, boolean>>(
    (accumulator, [key, rawValue]) => {
      const cleanKey = cleanString(key, 120);
      if (cleanKey && typeof rawValue === "boolean") {
        accumulator[cleanKey] = rawValue;
      }

      return accumulator;
    },
    {},
  );
}

function responseBody(responseText: string) {
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const webhookSecret = Deno.env.get("FOCANA_LIFECYCLE_WEBHOOK_SECRET") || "";
  const loopsApiKey = Deno.env.get("LOOPS_API_KEY") || "";

  if (!webhookSecret || !loopsApiKey) {
    return jsonResponse({
      ok: false,
      error: "Lifecycle email service is not configured",
    }, 500);
  }

  if (getBearerToken(request) !== webhookSecret) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  let payload: Record<string, unknown>;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const email = cleanEmail(payload.email);
  const userId = cleanString(payload.userId, 240);
  const eventName = cleanString(payload.eventName, 120);

  if (!email && !userId) {
    return jsonResponse(
      { ok: false, error: "email or userId is required" },
      400,
    );
  }

  if (!eventName) {
    return jsonResponse({ ok: false, error: "eventName is required" }, 400);
  }

  const loopsPayload: Record<string, unknown> = {
    eventName,
  };

  if (email) loopsPayload.email = email;
  if (userId) loopsPayload.userId = userId;

  const eventProperties = cleanPrimitiveMap(payload.eventProperties);
  if (Object.keys(eventProperties).length > 0) {
    loopsPayload.eventProperties = eventProperties;
  }

  const mailingLists = cleanMailingLists(payload.mailingLists);
  if (Object.keys(mailingLists).length > 0) {
    loopsPayload.mailingLists = mailingLists;
  }

  const reservedContactKeys = new Set([
    "email",
    "userId",
    "eventName",
    "eventProperties",
    "mailingLists",
  ]);
  const contactProperties = cleanPrimitiveMap(
    payload.contactProperties,
    reservedContactKeys,
  );

  Object.assign(loopsPayload, contactProperties);

  const idempotencyKey = cleanString(payload.idempotencyKey, 200) ||
    cleanString(request.headers.get("idempotency-key"), 200);

  let loopsResponse: Response;

  try {
    loopsResponse = await fetch(LOOPS_SEND_EVENT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loopsApiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(loopsPayload),
    });
  } catch {
    return jsonResponse({ ok: false, error: "Loops event send failed" }, 502);
  }

  const loopsResponseText = await loopsResponse.text();
  const loopsResult = responseBody(loopsResponseText);

  if (loopsResponse.status === 409) {
    return jsonResponse({
      ok: true,
      duplicate: true,
      loopsStatus: loopsResponse.status,
    }, 200);
  }

  if (!loopsResponse.ok) {
    return jsonResponse({
      ok: false,
      error: "Loops event send failed",
      loopsStatus: loopsResponse.status,
      loopsResult,
    }, 502);
  }

  return jsonResponse({
    ok: true,
    loopsStatus: loopsResponse.status,
    loopsResult,
  });
});
