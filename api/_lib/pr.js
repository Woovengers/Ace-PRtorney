import { toIso } from "./http.js";

const HOUR_MS = 60 * 60 * 1000;

export function hoursBetween(start, end) {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round((diff / HOUR_MS) * 10) / 10;
}

export function prPath(pr) {
  const [owner, name] = pr.repoFullName.split("/");
  return `/prs/${owner}/${name}/${pr.prNumber}`;
}

export function summarizePr(pr, reviews) {
  const reviewerEvents = reviews.filter((review) => review.authorRole === "reviewer");
  const firstReview = reviewerEvents[0] ?? null;
  const latestReview = reviews[reviews.length - 1] ?? null;
  const closedAt = pr.mergedAt ?? pr.closedAt ?? null;

  return {
    ...pr,
    firstReviewAt: firstReview?.submittedAt ?? null,
    latestReviewAt: latestReview?.submittedAt ?? null,
    firstReviewHours: hoursBetween(pr.createdAt, firstReview?.submittedAt),
    completionHours: hoursBetween(pr.createdAt, closedAt),
    rounds: reviewerEvents.filter((review) => review.state === "CHANGES_REQUESTED").length,
    reviewEvents: reviews.length,
    reviewerEvents: reviewerEvents.length,
    path: prPath(pr),
  };
}

export function buildTimeline(pr, reviews) {
  const events = [
    {
      type: "PR_OPENED",
      role: "crew",
      actor: pr.author,
      state: null,
      occurredAt: pr.createdAt,
      url: pr.url,
      label: "PR opened",
    },
  ];
  const firstReviewerEvent = reviews.find((review) => review.authorRole === "reviewer");
  const seenReviewer = new Set();

  for (const review of reviews) {
    if (review.authorRole === "crew") {
      events.push({
        type: "CREW_RESPONSE",
        role: "crew",
        actor: review.reviewer,
        state: review.state,
        occurredAt: review.submittedAt,
        url: review.url,
        label: "Crew response",
      });
      continue;
    }

    if (review.authorRole === "reviewer") {
      let type = "REREVIEW";
      if (review === firstReviewerEvent) type = "FIRST_REVIEW";
      if (review.state === "CHANGES_REQUESTED") type = "CHANGES_REQUESTED";
      if (review.state === "APPROVED") type = "APPROVED";
      if (!seenReviewer.has(review.reviewer) && type === "REREVIEW") type = "FIRST_REVIEW";
      seenReviewer.add(review.reviewer);

      events.push({
        type,
        role: "reviewer",
        actor: review.reviewer,
        state: review.state,
        occurredAt: review.submittedAt,
        url: review.url,
        label: type.replaceAll("_", " ").toLowerCase(),
      });
    }
  }

  const closedAt = pr.mergedAt ?? pr.closedAt;
  if (closedAt) {
    events.push({
      type: "CLOSED_OR_MERGED",
      role: "system",
      actor: pr.author,
      state: pr.mergedAt ? "MERGED" : "CLOSED",
      occurredAt: closedAt,
      url: pr.url,
      label: pr.mergedAt ? "Merged" : "Closed",
    });
  }

  return events
    .filter((event) => event.occurredAt)
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
}

export function rowToPr(row) {
  return {
    id: row.pr_id,
    repoFullName: row.repo_full_name,
    track: row.track,
    prNumber: row.pr_number,
    title: row.title,
    author: row.author_login,
    createdAt: toIso(row.created_at),
    closedAt: toIso(row.closed_at),
    mergedAt: toIso(row.merged_at),
    githubUpdatedAt: toIso(row.github_updated_at),
    url: row.pr_url,
  };
}

export function rowToReview(row) {
  return {
    id: row.review_id,
    reviewer: row.reviewer_login,
    authorRole: row.author_role,
    state: row.state,
    submittedAt: toIso(row.submitted_at),
    url: row.review_url,
  };
}
