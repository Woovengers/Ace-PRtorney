import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REVIEWPACE_REPOS } from "../../src/config/repos.js";
import { formatDbError, transaction, withClient } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..", "..");
const publicDir = path.join(projectRoot, "public");
const membersPath = path.join(publicDir, "members.json");
const statsPath = path.join(publicDir, "stats.json");

const PR_CHUNK_SIZE = 250;
const REVIEW_CHUNK_SIZE = 1_000;

function parseFullName(fullName) {
  const [owner, name] = fullName.split("/");
  if (!owner || !name) throw new Error(`Invalid repo full name: ${fullName}`);
  return { owner, name };
}

function normalizeTimestamp(value) {
  return value || null;
}

function githubUpdatedAtFor(pr) {
  return pr.mergedAt || pr.closedAt || pr.createdAt;
}

function eventKeyFor(pr, review) {
  return [
    `${pr.repo}#${pr.prNumber}`,
    review.reviewer || "unknown",
    review.submittedAt || "",
    review.state || "",
    review.url || "",
  ].join(":");
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function placeholders(rowCount, columnCount, offset = 0) {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const params = Array.from(
      { length: columnCount },
      (_, columnIndex) => `$${offset + rowIndex * columnCount + columnIndex + 1}`,
    );
    return `(${params.join(", ")})`;
  }).join(", ");
}

async function importRepos(client) {
  const values = REVIEWPACE_REPOS.flatMap((repo) => {
    const { owner, name } = parseFullName(repo.fullName);
    return [repo.fullName, owner, name, repo.track];
  });

  await client.query(
    `
      insert into repos (full_name, owner, name, track)
      values ${placeholders(REVIEWPACE_REPOS.length, 4)}
      on conflict (full_name) do update set
        owner = excluded.owner,
        name = excluded.name,
        track = excluded.track,
        updated_at = now()
    `,
    values,
  );

  const result = await client.query("select id, full_name from repos");
  return new Map(result.rows.map((row) => [row.full_name, row.id]));
}

async function importMembers(client, members) {
  for (const batch of chunk(members, 500)) {
    const values = batch.flatMap((member) => [
      member.githubId,
      member.nickname ?? null,
      member.cohort ?? null,
      member.roles ?? [],
      member.track ?? null,
      member.avatarUrl ?? null,
    ]);

    await client.query(
      `
        insert into members (github_id, nickname, cohort, roles, track, avatar_url)
        values ${placeholders(batch.length, 6)}
        on conflict (github_id) do update set
          nickname = excluded.nickname,
          cohort = excluded.cohort,
          roles = excluded.roles,
          track = excluded.track,
          avatar_url = excluded.avatar_url,
          updated_at = now()
      `,
      values,
    );
  }
}

async function importPullRequests(client, prs, repoIdMap) {
  const prIdMap = new Map();

  for (const batch of chunk(prs, PR_CHUNK_SIZE)) {
    const values = batch.flatMap((pr) => {
      const repoId = repoIdMap.get(pr.repo);
      if (!repoId) throw new Error(`Repo not found in database: ${pr.repo}`);

      return [
        null,
        repoId,
        pr.prNumber,
        pr.title ?? null,
        pr.author ?? null,
        pr.createdAt,
        normalizeTimestamp(pr.closedAt),
        normalizeTimestamp(pr.mergedAt),
        githubUpdatedAtFor(pr),
        pr.url ?? null,
      ];
    });

    const result = await client.query(
      `
        insert into pull_requests (
          github_node_id,
          repo_id,
          pr_number,
          title,
          author_login,
          created_at,
          closed_at,
          merged_at,
          github_updated_at,
          url
        )
        values ${placeholders(batch.length, 10)}
        on conflict (repo_id, pr_number) do update set
          github_node_id = coalesce(excluded.github_node_id, pull_requests.github_node_id),
          title = excluded.title,
          author_login = excluded.author_login,
          created_at = excluded.created_at,
          closed_at = excluded.closed_at,
          merged_at = excluded.merged_at,
          github_updated_at = excluded.github_updated_at,
          url = excluded.url,
          updated_at = now()
        returning id, repo_id, pr_number
      `,
      values,
    );

    for (const row of result.rows) {
      prIdMap.set(`${row.repo_id}#${row.pr_number}`, row.id);
    }
  }

  return prIdMap;
}

async function importReviewEvents(client, prs, repoIdMap, prIdMap) {
  let importedReviewCount = 0;
  const reviewRows = [];

  for (const pr of prs) {
    const repoId = repoIdMap.get(pr.repo);
    const prId = prIdMap.get(`${repoId}#${pr.prNumber}`);
    if (!prId) throw new Error(`PR not found in database: ${pr.repo}#${pr.prNumber}`);

    for (const review of pr.reviews ?? []) {
      reviewRows.push([
        null,
        eventKeyFor(pr, review),
        prId,
        review.reviewer ?? null,
        review.authorRole ?? "unknown",
        review.state ?? null,
        review.submittedAt,
        review.url ?? null,
      ]);
    }
  }

  for (const batch of chunk(reviewRows, REVIEW_CHUNK_SIZE)) {
    const values = batch.flat();

    await client.query(
      `
        insert into review_events (
          github_node_id,
          event_key,
          pr_id,
          reviewer_login,
          author_role,
          state,
          submitted_at,
          url
        )
        values ${placeholders(batch.length, 8)}
        on conflict (event_key) do update set
          github_node_id = coalesce(excluded.github_node_id, review_events.github_node_id),
          pr_id = excluded.pr_id,
          reviewer_login = excluded.reviewer_login,
          author_role = excluded.author_role,
          state = excluded.state,
          submitted_at = excluded.submitted_at,
          url = excluded.url,
          updated_at = now()
      `,
      values,
    );

    importedReviewCount += batch.length;
  }

  return importedReviewCount;
}

async function countTables(client) {
  const result = await client.query(`
    select
      (select count(*)::int from repos) as repos,
      (select count(*)::int from members) as members,
      (select count(*)::int from pull_requests) as pull_requests,
      (select count(*)::int from review_events) as review_events
  `);
  return result.rows[0];
}

async function verifySamples(client) {
  const result = await client.query(
    `
      select
        pr.pr_number,
        pr.author_login,
        re.reviewer_login,
        re.author_role,
        re.state,
        re.submitted_at
      from pull_requests pr
      join repos r on r.id = pr.repo_id
      join review_events re on re.pr_id = pr.id
      where r.full_name = $1
        and pr.pr_number = $2
        and re.reviewer_login in ($3, $4)
      order by re.submitted_at
      limit 8
    `,
    ["woowacourse/spring-roomescape-member", 410, "softmoca", "Gomding"],
  );

  return result.rows;
}

async function main() {
  const [membersJson, statsJson] = await Promise.all([
    fs.readFile(membersPath, "utf8").then(JSON.parse),
    fs.readFile(statsPath, "utf8").then(JSON.parse),
  ]);
  const members = membersJson.members ?? [];
  const prs = statsJson.prs ?? [];
  const reviewCount = prs.reduce((total, pr) => total + (pr.reviews?.length ?? 0), 0);

  await withClient(async (client) => {
    const before = await countTables(client);
    console.log(`Before import: ${JSON.stringify(before)}`);

    await transaction(client, async () => {
      const repoIdMap = await importRepos(client);
      console.log(`Repos upserted: ${REVIEWPACE_REPOS.length}`);

      await importMembers(client, members);
      console.log(`Members upserted: ${members.length}`);

      const prIdMap = await importPullRequests(client, prs, repoIdMap);
      console.log(`Pull requests upserted: ${prs.length}`);

      const importedReviews = await importReviewEvents(client, prs, repoIdMap, prIdMap);
      console.log(`Review events upserted: ${importedReviews}`);
    });

    const after = await countTables(client);
    const samples = await verifySamples(client);
    console.log(`After import: ${JSON.stringify(after)}`);
    console.log(`Source counts: ${JSON.stringify({ repos: REVIEWPACE_REPOS.length, members: members.length, pull_requests: prs.length, review_events: reviewCount })}`);
    console.log(`Sample #410 events: ${JSON.stringify(samples)}`);
  });
}

main().catch((error) => {
  console.error(formatDbError(error));
  process.exitCode = 1;
});
