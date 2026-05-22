import { fetchJson } from "./api.js";

export async function loadGithubSession() {
  return fetchJson("/api/auth/github/me");
}

export function startGithubLogin() {
  window.location.href = "/api/auth/github/start";
}

export async function logoutGithub() {
  return fetchJson("/api/auth/github/logout", { method: "POST" });
}

export async function postReviewReply({ owner, repo, pullNumber, commentId, body }) {
  return fetchJson("/api/trial/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ owner, repo, pullNumber, commentId, body }),
  });
}

export async function postLineComment({ owner, repo, pullNumber, commitId, path, line, body }) {
  return fetchJson("/api/trial/comment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ owner, repo, pullNumber, commitId, path, line, body }),
  });
}
