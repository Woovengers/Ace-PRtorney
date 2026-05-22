import { readGithubSession } from "../../_lib/auth.js";
import { methodNotAllowed, sendJson } from "../../_lib/http.js";

export default function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const session = readGithubSession(request);
  sendJson(response, 200, {
    authenticated: Boolean(session?.accessToken),
    user: session?.user ?? null,
  });
}
