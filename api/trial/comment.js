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

  const { owner, repo, pullNumber, commitId, path, line, body } = request.body ?? {};
  const lineNumber = Number(line);
  const prNumber = Number(pullNumber);

  if (
    !validText(owner)
    || !validText(repo)
    || !Number.isInteger(prNumber)
    || !validText(commitId)
    || !validText(path)
    || !Number.isInteger(lineNumber)
    || !validText(body)
  ) {
    sendError(response, 400, "invalid_comment_request", "owner, repo, pullNumber, commitId, path, line, and body are required");
    return;
  }

  try {
    const session = requireGithubSession(request);
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body,
          commit_id: commitId,
          path,
          line: lineNumber,
          side: "RIGHT",
        }),
      },
    );
    const payload = await githubResponse.json().catch(() => ({}));

    if (!githubResponse.ok) {
      sendError(response, githubResponse.status, "github_comment_failed", payload.message || "GitHub line comment request failed");
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
