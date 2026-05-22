import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REVIEWPACE_REPOS } from "../src/config/repos.js";

const GRAPHQL_URL = "https://api.github.com/graphql";
const REQUEST_DELAY_MS = 300;
const RATE_LIMIT_RESERVE = 20;
const SECONDARY_LIMIT_COOLDOWN_MS = 60_000;
const MAX_RETRIES = 4;
const CACHE_VERSION = 3;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const outputPath = path.join(publicDir, "stats.json");
const cacheDir = path.join(projectRoot, ".cache", "fetch-stats");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PULL_REQUESTS_QUERY = `
  query PullRequests($owner: String!, $name: String!, $after: String) {
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
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        totalCount
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
          url
          reviews(first: 100) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
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
      console.log(`모든 토큰 대기 중... ${Math.ceil(waitMs / 1000)}초 후 재개`);
      await delay(waitMs);
    }
  }
}

function getTokens() {
  const raw = process.env.GITHUB_TOKENS || process.env.GITHUB_TOKEN || "";
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  return [...new Set(tokens)];
}

function parseFullName(fullName) {
  const [owner, name] = fullName.split("/");

  if (!owner || !name) {
    throw new Error(`잘못된 레포 이름입니다: ${fullName}`);
  }

  return { owner, name };
}

function cachePathFor(fullName) {
  return path.join(cacheDir, `${fullName.replace("/", "__")}.json`);
}

function authorLogin(node) {
  return node?.author?.login || "unknown";
}

function classifyAuthor(prAuthor, actor) {
  if (!actor || actor === "unknown") return "unknown";
  return actor === prAuthor ? "crew" : "reviewer";
}

function normalizeReview(review, prAuthor) {
  const reviewer = authorLogin(review);

  return {
    reviewer,
    authorRole: classifyAuthor(prAuthor, reviewer),
    submittedAt: review.submittedAt || review.createdAt,
    state: review.state,
    url: review.url,
  };
}

function normalizePr(pr, repo, reviews) {
  return {
    repo: repo.fullName,
    track: repo.track,
    prNumber: pr.number,
    title: pr.title,
    author: authorLogin(pr),
    createdAt: pr.createdAt,
    closedAt: pr.closedAt,
    mergedAt: pr.mergedAt,
    url: pr.url,
    reviews: reviews
      .map((review) => normalizeReview(review, authorLogin(pr)))
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
          "User-Agent": "reviewpace-data-fetcher",
        },
        body: JSON.stringify({ query, variables }),
      });

      const text = await response.text();
      let payload;

      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`GitHub API가 JSON이 아닌 응답을 반환했습니다: ${text.slice(0, 80)}`);
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
          `GitHub API 오류(${response.status}): ${payload.message || response.statusText}`,
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

        throw new Error(`GraphQL 오류: ${message}`);
      }

      return payload.data;
    } catch (error) {
      lastError = error;
      const backoffMs = 1000 * 2 ** attempt;
      console.warn(`  요청 실패, 재시도 예정 (${attempt + 1}/${MAX_RETRIES + 1})`);
      await delay(backoffMs);
    }
  }

  throw lastError;
}

async function fetchMoreReviews(tokenPool, prId, pageInfo) {
  const reviews = [];
  let currentPageInfo = pageInfo;

  while (currentPageInfo.hasNextPage) {
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

async function readCachedRepo(fullName) {
  try {
    const content = await fs.readFile(cachePathFor(fullName), "utf8");
    const cached = JSON.parse(content);
    return cached.version === CACHE_VERSION ? cached : null;
  } catch {
    return null;
  }
}

async function writeCachedRepo(fullName, prs, totalCount) {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(
    cachePathFor(fullName),
    `${JSON.stringify({ version: CACHE_VERSION, fullName, totalCount, prs }, null, 2)}\n`,
  );
}

async function fetchRepo(tokenPool, repo, repoIndex, repoCount) {
  const cached = await readCachedRepo(repo.fullName);

  if (cached) {
    console.log(
      `[${repoIndex}/${repoCount}] ${repo.fullName} 캐시 사용 (${cached.prs.length}/${cached.totalCount}개 PR)`,
    );
    return cached.prs;
  }

  const { owner, name } = parseFullName(repo.fullName);
  const prs = [];
  let after = null;
  let page = 1;
  let totalCount = 0;

  console.log(`[${repoIndex}/${repoCount}] ${repo.fullName} 처리 중...`);

  while (true) {
    const data = await graphqlRequest(tokenPool, PULL_REQUESTS_QUERY, {
      owner,
      name,
      after,
    });

    if (!data.repository) {
      throw new Error(`레포를 찾지 못했습니다: ${repo.fullName}`);
    }

    const connection = data.repository.pullRequests;
    totalCount = connection.totalCount;
    console.log(`  page ${page}: ${connection.nodes.length}개 PR 수집 (${prs.length + connection.nodes.length}/${totalCount})`);

    for (const pr of connection.nodes) {
      const extraReviews = await fetchMoreReviews(tokenPool, pr.id, pr.reviews.pageInfo);
      prs.push(normalizePr(pr, repo, [...pr.reviews.nodes, ...extraReviews]));
    }

    if (!connection.pageInfo.hasNextPage) {
      break;
    }

    after = connection.pageInfo.endCursor;
    page += 1;
  }

  await writeCachedRepo(repo.fullName, prs, totalCount);
  return prs;
}

async function main() {
  const tokens = getTokens();

  if (tokens.length === 0) {
    console.error(".env에 GITHUB_TOKENS 또는 GITHUB_TOKEN을 설정해주세요.");
    process.exit(1);
  }

  const tokenPool = new TokenPool(tokens);
  const allPrs = [];

  await fs.mkdir(publicDir, { recursive: true });
  await fs.mkdir(cacheDir, { recursive: true });

  console.log(`총 ${REVIEWPACE_REPOS.length}개 레포 수집 시작`);
  console.log(`토큰 ${tokens.length}개 로테이션 사용`);

  for (const [index, repo] of REVIEWPACE_REPOS.entries()) {
    const prs = await fetchRepo(tokenPool, repo, index + 1, REVIEWPACE_REPOS.length);
    const reviewCount = prs.reduce((sum, pr) => sum + pr.reviews.length, 0);
    allPrs.push(...prs);
    console.log(`  완료: ${prs.length}개 PR, ${reviewCount}개 review`);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    prs: allPrs,
  };
  const totalReviews = allPrs.reduce((sum, pr) => sum + pr.reviews.length, 0);

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log(`총 ${allPrs.length}개 PR, ${totalReviews}개 review 저장 완료`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "알 수 없는 에러");
  process.exit(1);
});
