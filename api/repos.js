import { formatDbError, withClient } from "../scripts/db/db.js";
import { methodNotAllowed, sendError, sendJson, toIso } from "./_lib/http.js";
import { rowToPr, rowToReview, summarizePr } from "./_lib/pr.js";

function groupPrRows(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.pr_id)) {
      map.set(row.pr_id, { pr: rowToPr(row), reviews: [] });
    }
    if (row.review_id) map.get(row.pr_id).reviews.push(rowToReview(row));
  }

  return [...map.values()].map(({ pr, reviews }) => summarizePr(pr, reviews));
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const { owner, repo } = request.query;
  if (!owner || !repo) {
    sendError(response, 400, "invalid_repo", "owner and repo are required");
    return;
  }

  try {
    const payload = await withClient(async (client) => {
      const repoResult = await client.query(
        `
          select
            r.id,
            r.full_name,
            r.owner,
            r.name,
            r.track,
            coalesce(rs.summary, '{}'::jsonb) as summary
          from repos r
          left join repo_summary_stats rs on rs.repo_full_name = r.full_name
          where r.owner = $1
            and r.name = $2
        `,
        [owner, repo],
      );

      if (repoResult.rowCount === 0) return null;

      const repoRow = repoResult.rows[0];
      const prIdsResult = await client.query(
        `
          select id
          from pull_requests
          where repo_id = $1
          order by created_at desc
          limit 20
        `,
        [repoRow.id],
      );
      const prIds = prIdsResult.rows.map((row) => row.id);
      let recentPrs = [];

      if (prIds.length > 0) {
        const prRows = await client.query(
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
            where pr.id = any($1::bigint[])
            order by pr.created_at desc, re.submitted_at nulls last, re.id
          `,
          [prIds],
        );
        recentPrs = groupPrRows(prRows.rows);
      }

      const topReviewers = await client.query(
        `
          select reviewer_login as github_id, count(*)::int as events
          from review_events re
          join pull_requests pr on pr.id = re.pr_id
          where pr.repo_id = $1
            and re.author_role = 'reviewer'
            and re.reviewer_login is not null
          group by reviewer_login
          order by events desc
          limit 8
        `,
        [repoRow.id],
      );
      const topCrew = await client.query(
        `
          select author_login as github_id, count(*)::int as prs
          from pull_requests
          where repo_id = $1
            and author_login is not null
          group by author_login
          order by prs desc
          limit 8
        `,
        [repoRow.id],
      );

      return {
        repo: {
          fullName: repoRow.full_name,
          owner: repoRow.owner,
          name: repoRow.name,
          track: repoRow.track,
          ...repoRow.summary,
          latestActivityAt: repoRow.summary.latestActivityAt
            ? toIso(repoRow.summary.latestActivityAt)
            : null,
        },
        recentPrs,
        topReviewers: topReviewers.rows,
        topCrew: topCrew.rows,
      };
    });

    if (!payload) {
      sendError(response, 404, "repo_not_found", "Repo not found");
      return;
    }

    sendJson(response, 200, payload, "s-maxage=120, stale-while-revalidate=600");
  } catch (error) {
    sendError(response, 500, "api_failed", formatDbError(error));
  }
}
