function sum(values = []) {
  return values.reduce((total, value) => total + (value ?? 0), 0);
}

function dot(a = [], b = []) {
  return a.reduce((total, value, index) => total + (value ?? 0) * (b[index] ?? 0), 0);
}

function magnitude(values = []) {
  return Math.sqrt(values.reduce((total, value) => total + (value ?? 0) ** 2, 0));
}

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function timeOverlapScore(crewHours = [], reviewerHours = []) {
  if (sum(crewHours) === 0 || sum(reviewerHours) === 0) return 0;
  const denominator = magnitude(crewHours) * magnitude(reviewerHours);
  if (!denominator) return 0;
  return Math.round(clamp((dot(crewHours, reviewerHours) / denominator) * 100));
}

function speedScore(hours, targetHours) {
  if (!Number.isFinite(hours)) return 45;
  return Math.round(clamp(100 - (hours / targetHours) * 45));
}

function activityScore(reviewEvents) {
  if (!Number.isFinite(reviewEvents) || reviewEvents <= 0) return 0;
  return Math.round(clamp(Math.log10(reviewEvents + 1) * 34));
}

function sameTrackScore(crew, reviewer, includeDifferentTrackWithPenalty) {
  if (!crew.track || !reviewer.track) return 70;
  if (crew.track === reviewer.track) return 100;
  return includeDifferentTrackWithPenalty ? 35 : 0;
}

function reasonFor(label, score) {
  if (score >= 80) return `${label} 강함`;
  if (score >= 55) return `${label} 보통`;
  return `${label} 약함`;
}

export function calculateReviewerMatches(crew, people, options = {}) {
  if (!crew?.asCrew?.hasData) return [];

  const {
    candidateReviewerGithubIds = null,
    includeDifferentTrackWithPenalty = false,
    sameTrackOnly = true,
  } = options;
  const candidateSet = candidateReviewerGithubIds
    ? new Set(candidateReviewerGithubIds.filter(Boolean))
    : null;

  return people
    .filter((person) => {
      if (person.githubId === crew.githubId || !person.asReviewer?.hasData) return false;
      if (candidateSet && !candidateSet.has(person.githubId)) return false;
      if (sameTrackOnly && !includeDifferentTrackWithPenalty && crew.track && person.track !== crew.track) {
        return false;
      }
      return true;
    })
    .map((reviewer) => {
      const overlap = timeOverlapScore(
        crew.asCrew.activityByHour,
        reviewer.asReviewer.activityByHour,
      );
      const firstReviewSpeed = speedScore(reviewer.asReviewer.avgFirstResponseHours, 48);
      const rereviewSpeed = speedScore(reviewer.asReviewer.avgRereviewHours, 36);
      const trackFit = sameTrackScore(crew, reviewer, includeDifferentTrackWithPenalty);
      const recentActivity = activityScore(reviewer.asReviewer.reviewEvents);
      const score = Math.round(
        overlap * 0.4 +
          firstReviewSpeed * 0.25 +
          rereviewSpeed * 0.2 +
          trackFit * 0.1 +
          recentActivity * 0.05,
      );

      return {
        reviewer,
        score,
        scores: {
          overlap,
          firstReviewSpeed,
          rereviewSpeed,
          trackFit,
          recentActivity,
        },
        reasons: [
          reasonFor("활동 시간대", overlap),
          reasonFor("첫 리뷰 속도", firstReviewSpeed),
          reasonFor("재리뷰 속도", rereviewSpeed),
          trackFit >= 80 ? "같은 트랙 경험" : "다른 트랙 후보",
        ],
      };
    })
    .sort((a, b) => b.score - a.score || b.reviewer.asReviewer.reviewEvents - a.reviewer.asReviewer.reviewEvents);
}

export function compareReviewerCandidates(crew, people, candidateReviewerGithubIds, options = {}) {
  const candidateSet = new Set(candidateReviewerGithubIds.filter(Boolean));
  const excludedCandidates = people
    .filter((person) => candidateSet.has(person.githubId))
    .filter((person) => {
      if (!person.asReviewer?.hasData) return true;
      if (options.includeDifferentTrackWithPenalty) return false;
      return crew?.track && person.track !== crew.track;
    })
    .map((person) => ({
      githubId: person.githubId,
      displayName: person.displayName ?? person.nickname ?? person.githubId,
      track: person.track,
      reason: person.asReviewer?.hasData ? "different track" : "no reviewer data",
    }));

  return {
    matches: calculateReviewerMatches(crew, people, {
      candidateReviewerGithubIds,
      includeDifferentTrackWithPenalty: options.includeDifferentTrackWithPenalty ?? false,
      sameTrackOnly: true,
    }),
    excludedCandidates,
  };
}
