import "dotenv/config";
import { formatDbError, transaction, withClient } from "./db.js";

const GRAPHQL_URL = "https://api.github.com/graphql";
const REQUEST_DELAY_MS = 300;
const RATE_LIMIT_RESERVE = 20;
const SECONDARY_LIMIT_COOLDOWN_MS = 60_000;
const MAX_RETRIES = 4;
const SAFETY_WINDOW_MS = 24 * 60 * 60 * 1000;
const FALLBACK_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const UPDATED_PRS_QUERY = `
  query UpdatedPullRequests($owner: String!, $name: String!, $after: String) {
    rateLimit {
      cost
      remaining
      resetAt
    }
    repository(owner: $owner, name: $name) {
      pullRequests(
        states: [CLOSED, MERGED]
        first: 100
        after: $after
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          number
          title
          author {
            login
          }
          createdAt
          closedAt
          mergedAt
          updatedAt
          url
          reviews(first: 100) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              author {
                login
              }
              state
              submittedAt
              createdAt
              url
            }
          }
        }
      }
    }
  }
`;

const MORE_REVIEWS_QUERY = `
  query MoreReviews($id: ID!, $after: String) {
    rateLimit {
      cost
      remaining
      resetAt
    }
    node(id: $id) {
      ... on PullRequest {
        reviews(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            author {
              login
            }
            state
            submittedAt
            createdAt
            url
          }
        }
      }
    }
  }
`;

class TokenPool {
  constructor(tokens) {
    this.tokens = tokens.map((token, index) => ({
      token,
      index: index + 1,
      remaining: Number.POSITIVE_INFINITY,
      resetAt: 0,
      cooldownUntil: 0,
    }));
    this.nextIndex = 0;
  }

  update(tokenState, rateLimit) {
    if (!rateLimit) return;
    tokenState.remaining = rateLimit.remaining;
    tokenState.resetAt = Date.parse(rateLimit.resetAt);
  }

  markRateLimited(tokenState, resetAt) {
    tokenState.remaining = 0;
    tokenState.resetAt = resetAt || Date.now() + SECONDARY_LIMIT_COOLDOWN_MS;
  }

  markSecondaryLimited(tokenState) {
    tokenState.cooldownUntil = Date.now() + SECONDARY_LIMIT_COOLDOWN_MS;
  }

  async take() {
    while (true) {
      const now = Date.now();
      const candidates = this.tokens.filter((tokenState) => {
        const hasBudget = tokenState.remaining > RATE_LIMIT_RESERVE;
        const resetPassed =
          tokenState.remaining <= RATE_LIMIT_RESERVE && tokenState.resetAt <= now;
        return tokenState.cooldownUntil <= now && (hasBudget || resetPassed);
      });

      if (candidates.length > 0) {
        for (let offset = 0; offset < this.tokens.length; offset += 1) {
          const index = (this.nextIndex + offset) % this.tokens.length;
          const tokenState = this.tokens[index];
          if (candidates.includes(tokenState)) {
            this.nextIndex = (index + 1) % this.tokens.length;
            return tokenState;
          }
        }
      }

      const waitUntil = Math.min(
        ...this.tokens.map((tokenState) =>
          Math.max(
            tokenState.cooldownUntil,
            tokenState.resetAt || now + SECONDARY_LIMIT_COOLDOWN_MS,
          ),
        ),
      );
      const waitMs = Math.max(waitUntil - now, 1_000);
      console.log(`GitHub token wait: ${Math.ceil(waitMs / 1000)}s`);
      await delay(waitMs);
    }
  }
}

function getTokens() {
  const raw = process.env.GH_TOKENS || process.env.GITHUB_TOKENS || process.env.GITHUB_TOKEN || "";
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  return [...new Set(tokens)];
}

function authorLogin(node) {
  return node?.author?.login || "unknown";
}

function classifyAuthor(prAuthor, actor) {
  if (!actor || actor === "unknown") return "unknown";
  return actor === prAuthor ? "crew" : "reviewer";
}

function eventKeyFor(repoFullName, prNumber, review) {
  return [
    `${repoFullName}#${prNumber}`,
    review.reviewer || "unknown",
    review.submittedAt || "",
    review.state || "",
    review.url || "",
  ].join(":");
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function baselineFor(repo) {
  const baseline = toDate(repo.last_synced_at) ?? toDate(repo.max_pr_updated_at);
  return baseline ?? new Date(Date.now() - FALLBACK_LOOKBACK_MS);
}

function cutoffFor(repo) {
  return new Date(baselineFor(repo).getTime() - SAFETY_WINDOW_MS);
}

function parseIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeReview(review, prAuthor) {
  const reviewer = authorLogin(review);

  return {
    githubNodeId: review.id ?? null,
    reviewer,
    authorRole: classifyAuthor(prAuthor, reviewer),
    submittedAt: review.submittedAt || review.createdAt,
    state: review.state,
    url: review.url,
  };
}

function normalizePr(pr, repo, reviews) {
  const author = authorLogin(pr);

  return {
    githubNodeId: pr.id,
    repoFullName: repo.full_name,
    repoId: repo.id,
    prNumber: pr.number,
    title: pr.title,
    author,
    createdAt: pr.createdAt,
    closedAt: pr.closedAt,
    mergedAt: pr.mergedAt,
    githubUpdatedAt: pr.updatedAt,
    url: pr.url,
    reviews: reviews
      .map((review) => normalizeReview(review, author))
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt)),
  };
}

async function graphqlRequest(tokenPool, query, variables) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const tokenState = await tokenPool.take();
    await delay(REQUEST_DELAY_MS);

    try {
      const response = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenState.token}`,
          "Content-Type": "application/json",
          "User-Agent": "reviewpace-db-sync",
        },
        body: JSON.stringify({ query, variables }),
      });

      const text = await response.text();
      let payload;

      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`GitHub API returned a non-JSON response: ${text.slice(0, 80)}`);
      }

      if (!response.ok) {
        const resetHeader = response.headers.get("x-ratelimit-reset");
        const remainingHeader = response.headers.get("x-ratelimit-remaining");

        if (remainingHeader === "0") {
          tokenPool.markRateLimited(
            tokenState,
            resetHeader ? Number(resetHeader) * 1000 : undefined,
          );
        } else if (response.status === 403 || response.status === 429) {
          tokenPool.markSecondaryLimited(tokenState);
        }

        lastError = new Error(
          `GitHub API error (${response.status}): ${payload.message || response.statusText}`,
        );
        continue;
      }

      tokenPool.update(tokenState, payload.data?.rateLimit);

      if (payload.errors?.length > 0) {
        const message = payload.errors.map((error) => error.message).join("; ");
        if (/rate limit|secondary rate/i.test(message)) {
          tokenPool.markSecondaryLimited(tokenState);
          lastError = new Error(message);
          continue;
        }

        throw new Error(`GraphQL error: ${message}`);
      }

      return payload.data;
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === MAX_RETRIES;
      if (!isLastAttempt) {
        const backoffMs = 1000 * 2 ** attempt;
        console.warn(`  request failed, retrying (${attempt + 1}/${MAX_RETRIES + 1})`);
        await delay(backoffMs);
      }
    }
  }

  throw lastError;
}

async function fetchMoreReviews(tokenPool, prId, pageInfo) {
  const reviews = [];
  let currentPageInfo = pageInfo;

  while (currentPageInfo?.hasNextPage) {
    const data = await graphqlRequest(tokenPool, MORE_REVIEWS_QUERY, {
      id: prId,
      after: currentPageInfo.endCursor,
    });
    const connection = data.node.reviews;
    reviews.push(...connection.nodes);
    currentPageInfo = connection.pageInfo;
  }

  return reviews;
}

async function getRepos(client) {
  const result = await client.query(`
    select
      r.id,
      r.full_name,
      r.owner,
      r.name,
      r.track,
      r.last_synced_at,
      max(pr.github_updated_at) as max_pr_updated_at
    from repos r
    left join pull_requests pr on pr.repo_id = r.id
    group by r.id
    order by r.full_name
  `);
  return result.rows;
}

async function fetchRepoChanges(tokenPool, repo, repoIndex, repoCount) {
  const cutoff = cutoffFor(repo);
  const prs = [];
  let after = null;
  let page = 1;

  console.log(
    `[${repoIndex}/${repoCount}] ${repo.full_name}: cutoff ${cutoff.toISOString()}`,
  );

  while (true) {
    const data = await graphqlRequest(tokenPool, UPDATED_PRS_QUERY, {
      owner: repo.owner,
      name: repo.name,
      after,
    });

    if (!data.repository) {
      throw new Error(`Repository not found: ${repo.full_name}`);
    }

    const connection = data.repository.pullRequests;
    const nodes = connection.nodes ?? [];
    const changedNodes = nodes.filter((pr) => {
      const updatedAt = parseIso(pr.updatedAt);
      return updatedAt && updatedAt >= cutoff;
    });

    console.log(`  page ${page}: ${changedNodes.length}/${nodes.length} PRs in window`);

    for (const pr of changedNodes) {
      const extraReviews = await fetchMoreReviews(tokenPool, pr.id, pr.reviews.pageInfo);
      prs.push(normalizePr(pr, repo, [...pr.reviews.nodes, ...extraReviews]));
    }

    const onlyOlderThanCutoff =
      nodes.length > 0 &&
      nodes.every((pr) => {
        const updatedAt = parseIso(pr.updatedAt);
        return !updatedAt || updatedAt < cutoff;
      });

    if (!connection.pageInfo.hasNextPage || onlyOlderThanCutoff) {
      break;
    }

    after = connection.pageInfo.endCursor;
    page += 1;
  }

  return prs;
}

async function upsertPullRequests(client, prs) {
  const prIdMap = new Map();

  for (const pr of prs) {
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
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        returning id
      `,
      [
        pr.githubNodeId,
        pr.repoId,
        pr.prNumber,
        pr.title ?? null,
        pr.author ?? null,
        pr.createdAt,
        pr.closedAt ?? null,
        pr.mergedAt ?? null,
        pr.githubUpdatedAt,
        pr.url ?? null,
      ],
    );

    prIdMap.set(`${pr.repoId}#${pr.prNumber}`, result.rows[0].id);
  }

  return prIdMap;
}

async function upsertReviewEvent(client, row) {
  if (row.githubNodeId) {
    const updateResult = await client.query(
      `
        update review_events
        set
          event_key = coalesce(review_events.event_key, $2),
          pr_id = $3,
          reviewer_login = $4,
          author_role = $5,
          state = $6,
          submitted_at = $7,
          url = $8,
          updated_at = now()
        where github_node_id = $1
        returning id
      `,
      [
        row.githubNodeId,
        row.eventKey,
        row.prId,
        row.reviewer,
        row.authorRole,
        row.state,
        row.submittedAt,
        row.url,
      ],
    );

    if (updateResult.rowCount > 0) return;
  }

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
      values ($1, $2, $3, $4, $5, $6, $7, $8)
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
    [
      row.githubNodeId,
      row.eventKey,
      row.prId,
      row.reviewer,
      row.authorRole,
      row.state,
      row.submittedAt,
      row.url,
    ],
  );
}

async function upsertReviewEvents(client, prs, prIdMap) {
  let reviewCount = 0;

  for (const pr of prs) {
    const prId = prIdMap.get(`${pr.repoId}#${pr.prNumber}`);
    if (!prId) throw new Error(`PR id not found: ${pr.repoFullName}#${pr.prNumber}`);

    for (const review of pr.reviews) {
      if (!review.submittedAt) continue;
      await upsertReviewEvent(client, {
        githubNodeId: review.githubNodeId,
        eventKey: eventKeyFor(pr.repoFullName, pr.prNumber, review),
        prId,
        reviewer: review.reviewer ?? null,
        authorRole: review.authorRole ?? "unknown",
        state: review.state ?? null,
        submittedAt: review.submittedAt,
        url: review.url ?? null,
      });
      reviewCount += 1;
    }
  }

  return reviewCount;
}

async function syncRepo(client, tokenPool, repo, repoIndex, repoCount) {
  const prs = await fetchRepoChanges(tokenPool, repo, repoIndex, repoCount);
  const reviewCount = prs.reduce((total, pr) => total + pr.reviews.length, 0);

  await transaction(client, async () => {
    const prIdMap = await upsertPullRequests(client, prs);
    await upsertReviewEvents(client, prs, prIdMap);
    await client.query("update repos set last_synced_at = now(), updated_at = now() where id = $1", [
      repo.id,
    ]);
  });

  console.log(`  synced: ${prs.length} PRs, ${reviewCount} reviews`);
  return { prs: prs.length, reviews: reviewCount };
}

async function createSyncRun(client) {
  const result = await client.query(
    "insert into sync_runs (status, mode) values ('running', 'incremental') returning id",
  );
  return result.rows[0].id;
}

async function finishSyncRun(client, runId, status, counts, errorMessage = null) {
  await client.query(
    `
      update sync_runs
      set
        status = $2,
        finished_at = now(),
        fetched_prs = $3,
        fetched_reviews = $4,
        error_message = $5
      where id = $1
    `,
    [runId, status, counts.prs, counts.reviews, errorMessage?.slice(0, 1000) ?? null],
  );
}

async function main() {
  const tokens = getTokens();

  if (tokens.length === 0) {
    throw new Error("GH_TOKENS, GITHUB_TOKENS, or GITHUB_TOKEN is required");
  }

  const tokenPool = new TokenPool(tokens);

  await withClient(async (client) => {
    const repos = await getRepos(client);
    if (repos.length === 0) {
      throw new Error("No repos found. Run npm run db:import first.");
    }

    const runId = await createSyncRun(client);
    const counts = { prs: 0, reviews: 0 };

    try {
      console.log(`DB sync started: ${repos.length} repos, ${tokens.length} GitHub token(s)`);

      for (const [index, repo] of repos.entries()) {
        const result = await syncRepo(client, tokenPool, repo, index + 1, repos.length);
        counts.prs += result.prs;
        counts.reviews += result.reviews;
      }

      await finishSyncRun(client, runId, "success", counts);
      console.log(`DB sync success: ${counts.prs} PRs, ${counts.reviews} reviews fetched`);
    } catch (error) {
      await finishSyncRun(
        client,
        runId,
        "failed",
        counts,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });
}

main().catch((error) => {
  console.error(formatDbError(error));
  process.exitCode = 1;
});
