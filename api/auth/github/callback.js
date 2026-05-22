import {
  clearOAuthStateCookie,
  getOrigin,
  readOAuthStateCookie,
  setGithubSessionCookie,
} from "../../_lib/auth.js";
import { methodNotAllowed, sendError } from "../../_lib/http.js";

async function exchangeCode({ code, redirectUri }) {
  const clientId = process.env.GITHUB_APP_CLIENT_ID || process.env.GH_APP_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET || process.env.GH_APP_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(payload.error_description || payload.message || "GitHub OAuth token exchange failed");
  }
  return payload.access_token;
}

async function fetchGithubUser(accessToken) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "GitHub user request failed");
  }
  return payload;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const clientId = process.env.GITHUB_APP_CLIENT_ID || process.env.GH_APP_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET || process.env.GH_APP_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    sendError(response, 500, "github_app_auth_not_configured", "GITHUB_APP_CLIENT_ID/GH_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET/GH_APP_CLIENT_SECRET are required");
    return;
  }

  const { code, state } = request.query;
  if (!code || !state || state !== readOAuthStateCookie(request)) {
    sendError(response, 400, "invalid_oauth_state", "GitHub OAuth state is invalid");
    return;
  }

  try {
    const redirectUri = `${getOrigin(request)}/api/auth/github/callback`;
    const accessToken = await exchangeCode({ code, redirectUri });
    const user = await fetchGithubUser(accessToken);

    setGithubSessionCookie(response, {
      accessToken,
      user: {
        login: user.login,
        avatarUrl: user.avatar_url,
        htmlUrl: user.html_url,
      },
    });
    clearOAuthStateCookie(response);
    response.statusCode = 302;
    response.setHeader("Location", "/trial?github=connected");
    response.end();
  } catch (error) {
    sendError(response, 502, "github_app_user_auth_failed", error.message);
  }
}
