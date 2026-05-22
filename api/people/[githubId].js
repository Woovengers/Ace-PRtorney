import { formatDbError, withClient } from "../../scripts/db/db.js";
import { methodNotAllowed, sendError, sendJson } from "../_lib/http.js";
import { rowToPr, rowToReview, summarizePr } from "../_lib/pr.js";
import { serializePerson } from "../_lib/people.js";

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

  const { githubId } = request.query;
  if (!githubId) {
    sendError(response, 400, "invalid_person", "githubId is required");
    return;
  }

  try {
    const payload = await withClient(async (client) => {
      const personResult = await client.query(
        `
          select
            p.github_id,
            p.nickname,
            p.avatar_url,
            p.track,
            p.cohort,
            m.roles,
            p.as_crew,
            p.as_reviewer
          from person_summary_stats p
          left join members m on m.github_id = p.github_id
          where p.github_id = $1
        `,
        [githubId],
      );

      if (personResult.rowCount === 0) return null;

      const crewPrIds = await client.query(
        `
          select pr.id
          from pull_requests pr
          where pr.author_login = $1
          order by pr.created_at desc
          limit 10
        `,
        [githubId],
      );
      const reviewPrIds = await client.query(
        `
          select pr.id, max(re.submitted_at) as latest_review_at
          from review_events re
          join pull_requests pr on pr.id = re.pr_id
          where re.reviewer_login = $1
            and re.author_role = 'reviewer'
          group by pr.id
          order by latest_review_at desc
          limit 10
        `,
        [githubId],
      );
      const ids = [...new Set([...crewPrIds.rows, ...reviewPrIds.rows].map((row) => row.id))];

      let prs = [];
      if (ids.length > 0) {
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
          [ids],
        );
        prs = groupPrRows(prRows.rows);
      }

      const crewPrIdSet = new Set(crewPrIds.rows.map((row) => row.id));
      const reviewPrIdSet = new Set(reviewPrIds.rows.map((row) => row.id));

      return {
        person: serializePerson(personResult.rows[0]),
        recentCrewPrs: prs.filter((pr) => crewPrIdSet.has(pr.id)).slice(0, 10),
        recentReviewedPrs: prs.filter((pr) => reviewPrIdSet.has(pr.id)).slice(0, 10),
      };
    });

    if (!payload) {
      sendError(response, 404, "person_not_found", "Person not found");
      return;
    }

    sendJson(response, 200, payload, "s-maxage=120, stale-while-revalidate=600");
  } catch (error) {
    sendError(response, 500, "api_failed", formatDbError(error));
  }
}
