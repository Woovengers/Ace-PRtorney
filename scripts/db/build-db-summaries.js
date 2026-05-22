import { formatDbError, transaction, withClient } from "./db.js";

const TRACK_LABELS = {
  backend: "BE",
  frontend: "FE",
  android: "AN",
};

const HOUR_MS = 60 * 60 * 1000;
const RECENT_LIMIT = 24;
const RECENT_REVIEW_WINDOW_DAYS = 30;
const PERSON_CHUNK_SIZE = 500;
const RECENT_CHUNK_SIZE = 100;

function emptyHours() {
  return Array.from({ length: 24 }, () => 0);
}

function emptyWeekdays() {
  return Array.from({ length: 7 }, () => 0);
}

function emptyHeatmap() {
  return Array.from({ length: 7 }, () => emptyHours());
}

function kstParts(iso) {
  const date = new Date(iso);
  const kst = new Date(date.getTime() + 9 * HOUR_MS);
  const day = kst.getUTCDay();

  return {
    hour: kst.getUTCHours(),
    weekday: day === 0 ? 6 : day - 1,
  };
}

function addActivity(bucket, iso) {
  if (!iso) return;
  const { hour, weekday } = kstParts(iso);
  bucket.activityByHour[hour] += 1;
  bucket.activityByWeekday[weekday] += 1;
  bucket.activityHeatmap[weekday][hour] += 1;
}

function hoursBetween(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff / HOUR_MS;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  const sum = valid.reduce((total, value) => total + value, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

function median(values) {
  const valid = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const middle = Math.floor(valid.length / 2);
  const value = valid.length % 2 === 0
    ? (valid[middle - 1] + valid[middle]) / 2
    : valid[middle];
  return Math.round(value * 10) / 10;
}

function maxDateIso(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function clampFutureIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const now = new Date();
  return (date > now ? now : date).toISOString();
}

function cutoffIso(referenceAt, days = RECENT_REVIEW_WINDOW_DAYS) {
  if (!referenceAt) return null;
  const date = new Date(referenceAt);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function countSince(values, cutoff) {
  if (!cutoff) return 0;
  const cutoffTime = new Date(cutoff).getTime();
  return values.filter((value) => new Date(value).getTime() >= cutoffTime).length;
}

function formatTrackMeta(person) {
  const parts = [];
  if (person.cohort) parts.push(`${person.cohort}기`);
  if (person.track) parts.push(TRACK_LABELS[person.track] || person.track);
  return parts.join(" ");
}

function createPerson(githubId, member) {
  return {
    githubId,
    nickname: member?.nickname ?? null,
    avatarUrl: member?.avatarUrl ?? null,
    cohort: member?.cohort ?? null,
    roles: member?.roles ?? [],
    track: member?.track ?? null,
    displayName: member?.nickname ?? githubId,
    displayMeta: member
      ? [formatTrackMeta(member), `@${githubId}`].filter(Boolean).join(" · ")
      : `@${githubId}`,
    asReviewer: {
      hasData: false,
      reviewedPRs: 0,
      reviewEvents: 0,
      recent30dReviewCount: 0,
      latestReviewAt: null,
      avgFirstResponseHours: null,
      avgRereviewHours: null,
      rereviewSamples: 0,
      activityByHour: emptyHours(),
      activityByWeekday: emptyWeekdays(),
      activityHeatmap: emptyHeatmap(),
    },
    asCrew: {
      hasData: false,
      totalPRs: 0,
      latestCrewActivityAt: null,
      avgMissionHours: null,
      avgFirstReviewHours: null,
      avgReRequestHours: null,
      avgRoundsPerPR: null,
      activityByHour: emptyHours(),
      activityByWeekday: emptyWeekdays(),
      activityHeatmap: emptyHeatmap(),
    },
    _samples: {
      reviewerFirstResponseHours: [],
      reviewerRereviewHours: [],
      reviewedPrKeys: new Set(),
      reviewerSubmittedAts: [],
      crewMissionHours: [],
      crewFirstReviewHours: [],
      crewReRequestHours: [],
      crewRoundsPerPr: [],
    },
  };
}

function serializePerson(person) {
  const { _samples, ...serializable } = person;
  serializable.asReviewer.hasData =
    serializable.asReviewer.reviewedPRs > 0 || serializable.asReviewer.reviewEvents > 0;
  serializable.asCrew.hasData = serializable.asCrew.totalPRs > 0;
  return serializable;
}

function eventTypeForReviewer(review, firstReviewerEvent) {
  if (firstReviewerEvent === review) return "FIRST_REVIEW";
  if (review.state === "CHANGES_REQUESTED") return "CHANGES_REQUESTED";
  if (review.state === "APPROVED") return "APPROVED";
  return "REVIEW";
}

function memberFor(memberMap, githubId) {
  return memberMap.get(githubId) ?? null;
}

function createActivityItem({ githubId, member, role, track, repo, prNumber, eventType, occurredAt, url }) {
  return {
    githubId,
    nickname: member?.nickname ?? null,
    avatarUrl: member?.avatarUrl ?? null,
    cohort: member?.cohort ?? null,
    track: member?.track ?? track ?? null,
    trackLabel: TRACK_LABELS[member?.track ?? track] ?? null,
    repo,
    prNumber,
    role,
    eventType,
    occurredAt,
    url,
  };
}

function uniqueRecentPeople(items) {
  const seen = new Set();
  const uniqueItems = [];

  for (const item of items) {
    if (seen.has(item.githubId)) continue;
    seen.add(item.githubId);
    uniqueItems.push(item);
    if (uniqueItems.length >= RECENT_LIMIT) break;
  }

  return uniqueItems;
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

async function loadMembers(client) {
  const result = await client.query(`
    select github_id, nickname, cohort, roles, track, avatar_url
    from members
    order by github_id
  `);

  return result.rows.map((row) => ({
    githubId: row.github_id,
    nickname: row.nickname,
    cohort: row.cohort,
    roles: row.roles ?? [],
    track: row.track,
    avatarUrl: row.avatar_url,
  }));
}

async function loadPullRequests(client) {
  const result = await client.query(`
    select
      r.full_name as repo,
      r.track,
      pr.id as pr_id,
      pr.pr_number,
      pr.title,
      pr.author_login,
      pr.created_at,
      pr.closed_at,
      pr.merged_at,
      pr.url as pr_url,
      re.reviewer_login,
      re.author_role,
      re.state,
      re.submitted_at,
      re.url as review_url
    from pull_requests pr
    join repos r on r.id = pr.repo_id
    left join review_events re on re.pr_id = pr.id
    order by pr.id, re.submitted_at nulls last, re.id
  `);

  const prMap = new Map();

  for (const row of result.rows) {
    if (!prMap.has(row.pr_id)) {
      prMap.set(row.pr_id, {
        repo: row.repo,
        track: row.track,
        prNumber: row.pr_number,
        title: row.title,
        author: row.author_login,
        createdAt: toIso(row.created_at),
        closedAt: toIso(row.closed_at),
        mergedAt: toIso(row.merged_at),
        url: row.pr_url,
        reviews: [],
      });
    }

    if (row.submitted_at) {
      prMap.get(row.pr_id).reviews.push({
        reviewer: row.reviewer_login,
        authorRole: row.author_role,
        submittedAt: toIso(row.submitted_at),
        state: row.state,
        url: row.review_url,
      });
    }
  }

  return [...prMap.values()];
}

async function loadRecentReferenceAt(client) {
  const result = await client.query(`
    select
      (
        select max(finished_at)
        from sync_runs
        where status = 'success'
      ) as sync_reference_at,
      (
        select max(submitted_at)
        from review_events
        where author_role = 'reviewer'
      ) as latest_reviewer_event_at
  `);
  const row = result.rows[0] ?? {};
  return clampFutureIso(row.sync_reference_at ?? row.latest_reviewer_event_at);
}

function calculateStats(members, prs, recentReferenceAt) {
  const memberMap = new Map(members.map((member) => [member.githubId, member]));
  const people = new Map();
  const repoSummaries = new Map();
  const recentCrew = [];
  const recentReviewers = [];

  const ensurePerson = (githubId) => {
    if (!githubId || githubId === "unknown") return null;
    if (!people.has(githubId)) {
      people.set(githubId, createPerson(githubId, memberFor(memberMap, githubId)));
    }
    return people.get(githubId);
  };

  for (const member of members) {
    ensurePerson(member.githubId);
  }

  for (const pr of prs) {
    const prKey = `${pr.repo}#${pr.prNumber}`;
    const track = pr.track ?? null;
    const reviews = [...(pr.reviews ?? [])].sort(
      (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
    );
    const reviewerEvents = reviews.filter((review) => review.authorRole === "reviewer");
    const firstReviewerEvent = reviewerEvents[0] ?? null;
    const crew = ensurePerson(pr.author);

    if (!repoSummaries.has(pr.repo)) {
      repoSummaries.set(pr.repo, {
        repoFullName: pr.repo,
        track,
        prCount: 0,
        reviewEventCount: 0,
        reviewerEventCount: 0,
        crewCommentCount: 0,
        crewIds: new Set(),
        reviewerIds: new Set(),
        latestActivityAt: null,
      });
    }

    const repoSummary = repoSummaries.get(pr.repo);
    repoSummary.prCount += 1;
    repoSummary.reviewEventCount += reviews.length;
    repoSummary.reviewerEventCount += reviewerEvents.length;
    repoSummary.crewCommentCount += reviews.filter((review) => review.authorRole === "crew").length;
    repoSummary.latestActivityAt = maxDateIso(repoSummary.latestActivityAt, pr.createdAt);
    if (pr.author && pr.author !== "unknown") repoSummary.crewIds.add(pr.author);
    for (const review of reviewerEvents) {
      if (review.reviewer && review.reviewer !== "unknown") repoSummary.reviewerIds.add(review.reviewer);
    }

    if (crew) {
      crew.asCrew.totalPRs += 1;
      crew.asCrew.latestCrewActivityAt = maxDateIso(crew.asCrew.latestCrewActivityAt, pr.createdAt);
      addActivity(crew.asCrew, pr.createdAt);
      recentCrew.push(
        createActivityItem({
          githubId: pr.author,
          member: memberFor(memberMap, pr.author),
          role: "crew",
          track,
          repo: pr.repo,
          prNumber: pr.prNumber,
          eventType: "PR_OPENED",
          occurredAt: pr.createdAt,
          url: pr.url,
        }),
      );

      const missionHours = hoursBetween(pr.createdAt, pr.mergedAt || pr.closedAt);
      if (missionHours !== null) crew._samples.crewMissionHours.push(missionHours);

      if (firstReviewerEvent) {
        const firstReviewHours = hoursBetween(pr.createdAt, firstReviewerEvent.submittedAt);
        if (firstReviewHours !== null) crew._samples.crewFirstReviewHours.push(firstReviewHours);
      }

      crew._samples.crewRoundsPerPr.push(
        reviewerEvents.filter((review) => review.state === "CHANGES_REQUESTED").length,
      );
    }

    let pendingCrewRequestAt = null;
    const pendingReviewerRounds = new Map();
    const firstResponseSeen = new Set();

    for (const review of reviews) {
      repoSummary.latestActivityAt = maxDateIso(repoSummary.latestActivityAt, review.submittedAt);

      if (review.authorRole === "reviewer") {
        const reviewer = ensurePerson(review.reviewer);
        if (!reviewer) continue;

        reviewer.asReviewer.reviewEvents += 1;
        reviewer.asReviewer.latestReviewAt = maxDateIso(reviewer.asReviewer.latestReviewAt, review.submittedAt);
        reviewer._samples.reviewedPrKeys.add(prKey);
        reviewer._samples.reviewerSubmittedAts.push(review.submittedAt);
        addActivity(reviewer.asReviewer, review.submittedAt);

        if (!firstResponseSeen.has(review.reviewer)) {
          firstResponseSeen.add(review.reviewer);
          const firstResponseHours = hoursBetween(pr.createdAt, review.submittedAt);
          if (firstResponseHours !== null) {
            reviewer._samples.reviewerFirstResponseHours.push(firstResponseHours);
          }
        }

        const pendingRound = pendingReviewerRounds.get(review.reviewer);
        if (pendingRound?.phase === "waitingReviewer") {
          const rereviewHours = hoursBetween(
            pendingRound.crewResponseAt,
            review.submittedAt,
          );
          if (rereviewHours !== null) reviewer._samples.reviewerRereviewHours.push(rereviewHours);
          pendingReviewerRounds.delete(review.reviewer);
        }

        if (review.state === "CHANGES_REQUESTED") {
          pendingReviewerRounds.set(review.reviewer, {
            phase: "waitingCrew",
            changeRequestedAt: review.submittedAt,
            crewResponseAt: null,
          });
          pendingCrewRequestAt = review.submittedAt;
        }

        recentReviewers.push(
          createActivityItem({
            githubId: review.reviewer,
            member: memberFor(memberMap, review.reviewer),
            role: "reviewer",
            track,
            repo: pr.repo,
            prNumber: pr.prNumber,
            eventType: eventTypeForReviewer(review, firstReviewerEvent),
            occurredAt: review.submittedAt,
            url: review.url,
          }),
        );
      }

      if (review.authorRole === "crew" && crew) {
        addActivity(crew.asCrew, review.submittedAt);
        recentCrew.push(
          createActivityItem({
            githubId: pr.author,
            member: memberFor(memberMap, pr.author),
            role: "crew",
            track,
            repo: pr.repo,
            prNumber: pr.prNumber,
            eventType: pendingCrewRequestAt ? "RE_REQUEST" : "CREW_COMMENT",
            occurredAt: review.submittedAt,
            url: review.url,
          }),
        );

        if (pendingCrewRequestAt && review.state === "COMMENTED") {
          const reRequestHours = hoursBetween(pendingCrewRequestAt, review.submittedAt);
          if (reRequestHours !== null) crew._samples.crewReRequestHours.push(reRequestHours);
          pendingCrewRequestAt = null;
        }
      }

      if (review.authorRole === "crew" && review.state === "COMMENTED") {
        for (const [reviewerGithubId, pendingRound] of pendingReviewerRounds.entries()) {
          if (pendingRound.phase === "waitingCrew") {
            pendingReviewerRounds.set(reviewerGithubId, {
              ...pendingRound,
              phase: "waitingReviewer",
              crewResponseAt: review.submittedAt,
            });
          }
        }
      }
    }
  }

  const peopleRows = [...people.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([githubId, person]) => {
      const recentCutoff = cutoffIso(recentReferenceAt);
      person.asReviewer.reviewedPRs = person._samples.reviewedPrKeys.size;
      person.asReviewer.recent30dReviewCount = countSince(person._samples.reviewerSubmittedAts, recentCutoff);
      person.asReviewer.avgFirstResponseHours = average(person._samples.reviewerFirstResponseHours);
      person.asReviewer.avgRereviewHours = median(person._samples.reviewerRereviewHours);
      person.asReviewer.rereviewSamples = person._samples.reviewerRereviewHours.length;
      person.asCrew.avgMissionHours = average(person._samples.crewMissionHours);
      person.asCrew.avgFirstReviewHours = average(person._samples.crewFirstReviewHours);
      person.asCrew.avgReRequestHours = average(person._samples.crewReRequestHours);
      person.asCrew.avgRoundsPerPR = average(person._samples.crewRoundsPerPr);
      return [githubId, serializePerson(person)];
    });

  const repoRows = [...repoSummaries.values()]
    .sort((a, b) => a.repoFullName.localeCompare(b.repoFullName))
    .map((repo) => ({
      repoFullName: repo.repoFullName,
      track: repo.track,
      summary: {
        prCount: repo.prCount,
        reviewEventCount: repo.reviewEventCount,
        reviewerEventCount: repo.reviewerEventCount,
        crewCommentCount: repo.crewCommentCount,
        crewCount: repo.crewIds.size,
        reviewerCount: repo.reviewerIds.size,
        latestActivityAt: repo.latestActivityAt,
      },
    }));

  const byRecentTime = (a, b) => new Date(b.occurredAt) - new Date(a.occurredAt);
  const recentActivity = [
    ...uniqueRecentPeople(recentCrew.sort(byRecentTime)),
    ...uniqueRecentPeople(recentReviewers.sort(byRecentTime)),
  ];

  return { peopleRows, repoRows, recentActivity };
}

async function writePersonSummaries(client, peopleRows) {
  for (const batch of chunk(peopleRows, PERSON_CHUNK_SIZE)) {
    const values = batch.flatMap(([githubId, person]) => [
      githubId,
      person.nickname,
      person.avatarUrl,
      person.track,
      person.cohort,
      JSON.stringify(person.asCrew),
      JSON.stringify(person.asReviewer),
    ]);

    await client.query(
      `
        insert into person_summary_stats (
          github_id,
          nickname,
          avatar_url,
          track,
          cohort,
          as_crew,
          as_reviewer
        )
        values ${placeholders(batch.length, 7)}
      `,
      values,
    );
  }
}

async function writeRepoSummaries(client, repoRows) {
  for (const repo of repoRows) {
    await client.query(
      `
        insert into repo_summary_stats (repo_full_name, track, summary)
        values ($1, $2, $3)
      `,
      [repo.repoFullName, repo.track, JSON.stringify(repo.summary)],
    );
  }
}

async function writeRecentActivities(client, recentActivity) {
  for (const batch of chunk(recentActivity, RECENT_CHUNK_SIZE)) {
    const values = batch.flatMap((item) => [
      item.githubId,
      item.nickname,
      item.avatarUrl,
      item.role,
      item.track,
      item.repo,
      item.prNumber,
      item.eventType,
      item.occurredAt,
      item.url,
    ]);

    await client.query(
      `
        insert into recent_activities (
          github_id,
          nickname,
          avatar_url,
          role,
          track,
          repo_full_name,
          pr_number,
          event_type,
          occurred_at,
          url
        )
        values ${placeholders(batch.length, 10)}
      `,
      values,
    );
  }
}

async function main() {
  await withClient(async (client) => {
    const members = await loadMembers(client);
    const prs = await loadPullRequests(client);
    const recentReferenceAt = await loadRecentReferenceAt(client);
    const { peopleRows, repoRows, recentActivity } = calculateStats(members, prs, recentReferenceAt);

    await transaction(client, async () => {
      await client.query("truncate person_summary_stats, repo_summary_stats, recent_activities");
      await writePersonSummaries(client, peopleRows);
      await writeRepoSummaries(client, repoRows);
      await writeRecentActivities(client, recentActivity);
    });

    const crewRecent = recentActivity.filter((item) => item.role === "crew").length;
    const reviewerRecent = recentActivity.filter((item) => item.role === "reviewer").length;

    console.log(`DB summaries rebuilt: ${peopleRows.length} people, ${repoRows.length} repos`);
    console.log(`Recent activities: ${crewRecent} crew, ${reviewerRecent} reviewers`);
  });
}

main().catch((error) => {
  console.error(formatDbError(error));
  process.exitCode = 1;
});
