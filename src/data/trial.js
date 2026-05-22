import { fetchJson } from "./api.js";

export function parseGithubPrUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== "github.com") return null;
    const [, owner, repo, pullSegment, number] = url.pathname.split("/");
    if (!owner || !repo || pullSegment !== "pull" || !Number.isInteger(Number(number))) return null;
    return { owner, repo, number: Number(number) };
  } catch {
    return null;
  }
}

export async function loadTrialPr(prUrl) {
  return fetchJson(`/api/trial/pr?url=${encodeURIComponent(prUrl)}`);
}
