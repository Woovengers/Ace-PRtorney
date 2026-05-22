import { formatDbError, withClient } from "../../scripts/db/db.js";

export function sendJson(response, status, payload, cacheControl = null) {
  if (cacheControl) response.setHeader("Cache-Control", cacheControl);
  response.status(status).json(payload);
}

export function sendError(response, status, code, message) {
  sendJson(response, status, { error: code, message });
}

export function methodNotAllowed(response, allowed) {
  response.setHeader("Allow", allowed.join(", "));
  sendError(response, 405, "method_not_allowed", `Allowed methods: ${allowed.join(", ")}`);
}

export async function handleApi(response, callback) {
  try {
    const payload = await withClient(callback);
    sendJson(response, 200, payload, "s-maxage=120, stale-while-revalidate=600");
  } catch (error) {
    sendError(response, 500, "api_failed", formatDbError(error));
  }
}

export function toIso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
