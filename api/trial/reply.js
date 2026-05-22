import { requireGithubSession } from "../_lib/auth.js";
import { methodNotAllowed, sendError, sendJson } from "../_lib/http.js";

function validText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  const { owner, repo, pullNumber, commentId, body } = request.body ?? {};
  const prNumber = Number(pullNumber);

  if (!validText(owner) || !validText(repo) || !Number.isInteger(prNumber) || !validText(commentId) || !validText(body)) {
    sendError(response, 400, "invalid_reply_request", "owner, repo, pullNumber, commentId, and body are required");
    return;
  }

  try {
    const session = requireGithubSession(request);
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments/${commentId}/replies`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      },
    );
    const payload = await githubResponse.json().catch(() => ({}));

    if (!githubResponse.ok) {
      sendError(
        response,
        githubResponse.status,
        "github_reply_failed",
        payload.message || "GitHub reply request failed",
      );
      return;
    }

    sendJson(response, 201, {
      id: payload.id,
      url: payload.html_url,
      body: payload.body,
      user: payload.user?.login ?? session.user?.login,
    });
  } catch (error) {
    sendError(response, 401, "github_login_required", error.message);
  }
}
