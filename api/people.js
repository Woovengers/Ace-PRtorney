import { formatDbError, withClient } from "../scripts/db/db.js";
import { methodNotAllowed, sendError, sendJson } from "./_lib/http.js";
import { rowToPr, rowToReview, summarizePr } from "./_lib/pr.js";
import { serializePerson } from "./_lib/people.js";

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

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntegerQuery(value, fallback, { min, max }) {
  const parsed = Number.parseInt(firstQueryValue(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

async function hydratePrs(client, ids) {
  if (ids.length === 0) return [];

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
      order by array_position($1::bigint[], pr.id), re.submitted_at nulls last, re.id
    `,
    [ids],
  );

  return groupPrRows(prRows.rows);
}

async function loadCrewPrPage(client, githubId, limit, offset) {
  const countResult = await client.query(
    `
      select count(*)::int as total
      from pull_requests
      where author_login = $1
    `,
    [githubId],
  );
  const idResult = await client.query(
    `
      select id
      from pull_requests
      where author_login = $1
      order by created_at desc, id desc
      limit $2 offset $3
    `,
    [githubId, limit, offset],
  );

  const total = countResult.rows[0]?.total ?? 0;
  const ids = idResult.rows.map((row) => row.id);
  const items = await hydratePrs(client, ids);
  const nextOffset = offset + items.length;

  return {
    items,
    total,
    nextOffset,
    hasMore: nextOffset < total,
  };
}

async function loadReviewerPrPage(client, githubId, limit, offset) {
  const countResult = await client.query(
    `
      select count(distinct pr.id)::int as total
      from review_events re
      join pull_requests pr on pr.id = re.pr_id
      where re.reviewer_login = $1
        and re.author_role = 'reviewer'
    `,
    [githubId],
  );
  const idResult = await client.query(
    `
      select pr.id, max(re.submitted_at) as latest_review_at
      from review_events re
      join pull_requests pr on pr.id = re.pr_id
      where re.reviewer_login = $1
        and re.author_role = 'reviewer'
      group by pr.id
      order by latest_review_at desc, pr.id desc
      limit $2 offset $3
    `,
    [githubId, limit, offset],
  );

  const total = countResult.rows[0]?.total ?? 0;
  const ids = idResult.rows.map((row) => row.id);
  const items = await hydratePrs(client, ids);
  const nextOffset = offset + items.length;

  return {
    items,
    total,
    nextOffset,
    hasMore: nextOffset < total,
  };
}

function loadPrPage(client, mode, githubId, limit, offset) {
  return mode === "reviewer"
    ? loadReviewerPrPage(client, githubId, limit, offset)
    : loadCrewPrPage(client, githubId, limit, offset);
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const githubId = firstQueryValue(request.query.githubId);
  const mode = firstQueryValue(request.query.mode);
  const pageMode = mode === "crew" || mode === "reviewer" ? mode : null;
  const limit = parseIntegerQuery(request.query.limit, 20, { min: 1, max: 50 });
  const offset = parseIntegerQuery(request.query.offset, 0, { min: 0, max: 100000 });
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

      const crewPage = await loadCrewPrPage(client, githubId, 10, 0);
      const reviewerPage = await loadReviewerPrPage(client, githubId, 10, 0);
      const selectedPage = pageMode ? await loadPrPage(client, pageMode, githubId, limit, offset) : null;

      return {
        person: serializePerson(personResult.rows[0]),
        recentCrewPrs: crewPage.items,
        recentReviewedPrs: reviewerPage.items,
        prList: selectedPage
          ? {
              mode: pageMode,
              limit,
              offset,
              ...selectedPage,
            }
          : null,
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
