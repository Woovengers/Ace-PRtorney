import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REVIEWPACE_REPOS } from "../src/config/repos.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const publicDir = path.join(projectRoot, "public");

const membersPath = path.join(publicDir, "members.json");
const statsPath = path.join(publicDir, "stats.json");
const personStatsPath = path.join(publicDir, "person-stats.json");
const summaryPath = path.join(publicDir, "summary.json");
const recentActivityPath = path.join(publicDir, "recent-activity.json");

const TRACK_LABELS = {
  backend: "BE",
  frontend: "FE",
  android: "AN",
};

const HOUR_MS = 60 * 60 * 1000;
const RECENT_LIMIT = 24;
const RECENT_REVIEW_WINDOW_DAYS = 30;

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

function clampFutureIso(value) {
  if (!value) return null;
  const date = new Date(value);
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

async function main() {
  const generatedAt = new Date().toISOString();
  const [membersJson, statsJson] = await Promise.all([
    fs.readFile(membersPath, "utf8").then(JSON.parse),
    fs.readFile(statsPath, "utf8").then(JSON.parse),
  ]);

  const members = membersJson.members ?? [];
  const prs = statsJson.prs ?? [];
  const memberMap = new Map(members.map((member) => [member.githubId, member]));
  const repoTrackMap = new Map(REVIEWPACE_REPOS.map((repo) => [repo.fullName, repo.track]));
  const people = new Map();
  const trackDistribution = new Map();
  const recentCrew = [];
  const recentReviewers = [];
  let totalReviewEvents = 0;
  let totalReviewerEvents = 0;
  let latestActivityAt = null;

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
    const track = pr.track ?? repoTrackMap.get(pr.repo) ?? null;
    const reviews = [...(pr.reviews ?? [])].sort(
      (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
    );
    const reviewerEvents = reviews.filter((review) => review.authorRole === "reviewer");
    const firstReviewerEvent = reviewerEvents[0] ?? null;
    const crew = ensurePerson(pr.author);

    trackDistribution.set(track ?? "unknown", (trackDistribution.get(track ?? "unknown") ?? 0) + 1);
    totalReviewEvents += reviews.length;

    if (crew) {
      crew.asCrew.totalPRs += 1;
      crew.asCrew.latestCrewActivityAt = maxDateIso(crew.asCrew.latestCrewActivityAt, pr.createdAt);
      addActivity(crew.asCrew, pr.createdAt);
      latestActivityAt = maxDateIso(latestActivityAt, pr.createdAt);
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
      latestActivityAt = maxDateIso(latestActivityAt, review.submittedAt);

      if (review.authorRole === "reviewer") {
        totalReviewerEvents += 1;
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

      if (review.authorRole === "crew") {
        if (crew) {
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

        if (review.state === "COMMENTED") {
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
  }

  const peopleObject = {};
  const recentReferenceAt = clampFutureIso(statsJson.generatedAt ?? latestActivityAt ?? generatedAt);
  const recentCutoff = cutoffIso(recentReferenceAt);
  for (const [githubId, person] of [...people.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    person.asReviewer.reviewedPRs = person._samples.reviewedPrKeys.size;
    person.asReviewer.recent30dReviewCount = countSince(person._samples.reviewerSubmittedAts, recentCutoff);
    person.asReviewer.avgFirstResponseHours = average(person._samples.reviewerFirstResponseHours);
    person.asReviewer.avgRereviewHours = median(person._samples.reviewerRereviewHours);
    person.asReviewer.rereviewSamples = person._samples.reviewerRereviewHours.length;
    person.asCrew.avgMissionHours = average(person._samples.crewMissionHours);
    person.asCrew.avgFirstReviewHours = average(person._samples.crewFirstReviewHours);
    person.asCrew.avgReRequestHours = average(person._samples.crewReRequestHours);
    person.asCrew.avgRoundsPerPR = average(person._samples.crewRoundsPerPr);
    peopleObject[githubId] = serializePerson(person);
  }

  const totalPeople = Object.keys(peopleObject).length;
  const trackDistributionRows = [...trackDistribution.entries()]
    .filter(([track]) => track !== "unknown")
    .map(([track, prsCount]) => ({
      track,
      trackLabel: TRACK_LABELS[track] ?? track,
      prs: prsCount,
      percent: Math.round((prsCount / prs.length) * 100),
    }))
    .sort((a, b) => b.prs - a.prs);

  const byRecentTime = (a, b) => new Date(b.occurredAt) - new Date(a.occurredAt);
  const recentActivity = {
    generatedAt,
    crew: uniqueRecentPeople(recentCrew.sort(byRecentTime)),
    reviewers: uniqueRecentPeople(recentReviewers.sort(byRecentTime)),
  };

  const summary = {
    generatedAt,
    sourceGeneratedAt: statsJson.generatedAt ?? null,
    recentReferenceAt,
    membersGeneratedAt: membersJson.generatedAt ?? null,
    latestActivityAt,
    totalPRs: prs.length,
    totalReviewEvents,
    totalReviewerEvents,
    totalRepos: REVIEWPACE_REPOS.length,
    activeRepos: new Set(prs.map((pr) => pr.repo)).size,
    totalMembers: members.length,
    totalPeople,
    trackDistribution: trackDistributionRows,
  };

  const personStats = {
    generatedAt,
    sourceGeneratedAt: statsJson.generatedAt ?? null,
    recentReferenceAt,
    people: peopleObject,
  };

  await Promise.all([
    fs.writeFile(personStatsPath, `${JSON.stringify(personStats, null, 2)}\n`),
    fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`),
    fs.writeFile(recentActivityPath, `${JSON.stringify(recentActivity, null, 2)}\n`),
  ]);

  console.log(`person-stats: ${Object.keys(peopleObject).length} people`);
  console.log(`summary: ${prs.length} PRs, ${totalReviewEvents} review events`);
  console.log(
    `recent-activity: ${recentActivity.crew.length} crew, ${recentActivity.reviewers.length} reviewers`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
