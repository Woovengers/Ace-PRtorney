import { formatDbError, withClient } from "../scripts/db/db.js";
import { methodNotAllowed, sendError, sendJson } from "./_lib/http.js";
import { buildTimeline, rowToPr, rowToReview, summarizePr } from "./_lib/pr.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const { owner, repo, number } = request.query;
  const prNumber = Number(number);
  if (!owner || !repo || !Number.isInteger(prNumber)) {
    sendError(response, 400, "invalid_pr", "owner, repo, and numeric number are required");
    return;
  }

  try {
    const payload = await withClient(async (client) => {
    const result = await client.query(
      `
        select
          pr.id as pr_id,
          r.full_name as repo_full_name,
          r.track,
          pr.pr_number,
          pr.title,
          pr.author_login,
          pr.created_at,
          pr.closed_at,
          pr.merged_at,
          pr.github_updated_at,
          pr.url as pr_url,
          re.id as review_id,
          re.reviewer_login,
          re.author_role,
          re.state,
          re.submitted_at,
          re.url as review_url
        from pull_requests pr
        join repos r on r.id = pr.repo_id
        left join review_events re on re.pr_id = pr.id
        where r.owner = $1
          and r.name = $2
          and pr.pr_number = $3
        order by re.submitted_at nulls last, re.id
      `,
      [owner, repo, prNumber],
    );

    if (result.rowCount === 0) {
      return null;
    }

    const pr = rowToPr(result.rows[0]);
    const reviews = result.rows.filter((row) => row.review_id).map(rowToReview);
    const summary = summarizePr(pr, reviews);

    return {
      pr: summary,
      reviews,
      events: buildTimeline(pr, reviews),
      metrics: {
        firstReviewHours: summary.firstReviewHours,
        completionHours: summary.completionHours,
        rounds: summary.rounds,
        reviewEvents: summary.reviewEvents,
      },
    };
  });

    if (!payload) {
      sendError(response, 404, "pr_not_found", "PR not found");
      return;
    }

    sendJson(response, 200, payload, "s-maxage=120, stale-while-revalidate=600");
  } catch (error) {
    sendError(response, 500, "api_failed", formatDbError(error));
  }
}
