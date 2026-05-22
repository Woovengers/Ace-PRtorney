import crypto from "node:crypto";
import { getOrigin, setOAuthStateCookie } from "../../_lib/auth.js";
import { methodNotAllowed, sendError } from "../../_lib/http.js";

export default function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const clientId = process.env.GITHUB_APP_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    sendError(response, 500, "github_app_auth_not_configured", "GITHUB_APP_CLIENT_ID is required");
    return;
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const redirectUri = `${getOrigin(request)}/api/auth/github/callback`;
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  setOAuthStateCookie(response, state);
  response.statusCode = 302;
  response.setHeader("Location", authorizeUrl.toString());
  response.end();
}
