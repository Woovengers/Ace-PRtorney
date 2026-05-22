import { clearGithubSessionCookie } from "../../_lib/auth.js";
import { methodNotAllowed, sendJson } from "../../_lib/http.js";

export default function handler(request, response) {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  clearGithubSessionCookie(response);
  sendJson(response, 200, { ok: true });
}
