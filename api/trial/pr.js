import { readGithubSession } from "../_lib/auth.js";
import { methodNotAllowed, sendError, sendJson } from "../_lib/http.js";

const GITHUB_API = "https://api.github.com";

function parseGithubPrUrl(value) {
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

function getGithubToken(request) {
  const session = readGithubSession(request);
  if (session?.accessToken) return session.accessToken;

  const raw = process.env.GH_TOKENS || process.env.GITHUB_TOKENS || process.env.GITHUB_TOKEN || "";
  return raw.split(",").map((token) => token.trim()).find(Boolean) ?? null;
}

async function githubFetch(request, path) {
  const token = getGithubToken(request);
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `GitHub request failed: ${response.status}`);
  }

  return response.json();
}

function lineText(rawLine) {
  if (!rawLine) return "";
  if (rawLine.startsWith("+") || rawLine.startsWith("-") || rawLine.startsWith(" ")) {
    return rawLine.slice(1);
  }
  return rawLine;
}

function parseDiffHunk(diffHunk, targetLine) {
  if (!diffHunk) return [];
  const lines = diffHunk.split("\n");
  let newLine = null;
  let oldLine = null;
  const parsed = [];

  for (const raw of lines) {
    const header = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      parsed.push({
        type: "hunk",
        oldLine: null,
        newLine: null,
        line: null,
        code: raw,
        flagged: false,
      });
      continue;
    }
    if (newLine == null) continue;

    const type = raw.startsWith("+") ? "add" : raw.startsWith("-") ? "delete" : "context";
    const line = type === "delete" ? null : newLine;
    parsed.push({
      type,
      oldLine: type === "add" ? null : oldLine,
      newLine: type === "delete" ? null : newLine,
      line,
      code: lineText(raw),
      flagged: targetLine ? line === targetLine : false,
    });
    if (type !== "add") oldLine += 1;
    if (type !== "delete") newLine += 1;
  }

  return parsed.slice(-80);
}

function fallbackPatchLines(patch) {
  if (!patch) return [];
  const lines = patch.split("\n");
  let newLine = null;
  let oldLine = null;
  const parsed = [];

  for (const raw of lines) {
    const header = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      parsed.push({
        type: "hunk",
        oldLine: null,
        newLine: null,
        line: null,
        code: raw,
        flagged: false,
      });
      continue;
    }
    if (newLine == null) continue;

    const type = raw.startsWith("+") ? "add" : raw.startsWith("-") ? "delete" : "context";
    parsed.push({
      type,
      oldLine: type === "add" ? null : oldLine,
      newLine: type === "delete" ? null : newLine,
      line: type === "delete" ? null : newLine,
      code: lineText(raw),
      flagged: false,
    });
    if (type !== "add") oldLine += 1;
    if (type !== "delete") newLine += 1;
    if (parsed.length >= 120) break;
  }

  return parsed;
}

function buildComment(comment) {
  const line = comment.line ?? comment.original_line ?? null;
  return {
    id: String(comment.id),
    label: comment.in_reply_to_id ? "증거 제출" : "이의 있음",
    actor: comment.user?.login ?? "reviewer",
    role: comment.in_reply_to_id ? "attorney" : "prosecutor",
    inReplyToId: comment.in_reply_to_id ?? null,
    body: comment.body || "(내용 없음)",
    claim: comment.body || "(내용 없음)",
    evidence: `${comment.path}${line ? `:${line}` : ""}의 diff hunk를 근거로 검토합니다.`,
    color: comment.in_reply_to_id ? "blue" : "red",
    path: comment.path,
    line,
    url: comment.html_url,
    diffLines: parseDiffHunk(comment.diff_hunk, line),
  };
}

function buildIssueComment(comment) {
  return {
    id: String(comment.id),
    actor: comment.user?.login ?? "commenter",
    body: comment.body || "(내용 없음)",
    url: comment.html_url,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    authorAssociation: comment.author_association ?? null,
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const parsed = parseGithubPrUrl(request.query.url);
  if (!parsed) {
    sendError(response, 400, "invalid_pr_url", "A GitHub pull request URL is required");
    return;
  }

  try {
    const base = `/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`;
    const [pr, files, comments, issueComments] = await Promise.all([
      githubFetch(request, base),
      githubFetch(request, `${base}/files?per_page=100`),
      githubFetch(request, `${base}/comments?per_page=100`),
      githubFetch(request, `/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}/comments?per_page=100`),
    ]);
    const firstFile = files[0] ?? null;
    const normalizedComments = comments.map(buildComment);
    const selectedComment = normalizedComments.find((comment) => !comment.inReplyToId) ?? normalizedComments[0] ?? {
      id: "no-review-comments",
      label: "코멘트 없음",
      actor: "GitHub",
      role: "prosecutor",
      body: "이 PR에는 아직 라인 리뷰 코멘트가 없습니다.",
      claim: "이 PR에는 아직 법정 공방으로 전환할 라인 코멘트가 없습니다.",
      evidence: firstFile ? `${firstFile.filename}의 변경 내용을 먼저 검토합니다.` : "변경 파일이 없습니다.",
      color: "red",
      path: firstFile?.filename ?? "unknown",
      line: null,
      url: pr.html_url,
      diffLines: fallbackPatchLines(firstFile?.patch),
    };

    sendJson(response, 200, {
      pr: {
        owner: parsed.owner,
        repo: parsed.repo,
        number: parsed.number,
        title: pr.title,
        author: pr.user?.login ?? "unknown",
        headSha: pr.head?.sha ?? null,
        url: pr.html_url,
        changedFiles: pr.changed_files ?? files.length,
        additions: pr.additions ?? files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
        deletions: pr.deletions ?? files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
        reviewComments: pr.review_comments ?? comments.length,
        conversationComments: pr.comments ?? issueComments.length,
      },
      files: files.map((file) => ({
        path: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patchLines: fallbackPatchLines(file.patch),
      })),
      comments: normalizedComments,
      issueComments: issueComments.map(buildIssueComment),
      selectedComment,
    });
  } catch (error) {
    sendError(response, 502, "github_pr_load_failed", error.message);
  }
}
