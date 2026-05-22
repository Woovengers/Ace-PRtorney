import { useMemo } from "react";
import ActivityBars from "../charts/ActivityBars.jsx";
import AppHeader from "../common/AppHeader.jsx";
import MetricCard from "../common/MetricCard.jsx";
import Surface from "../common/Surface.jsx";
import { formatHours, formatNumber } from "../../utils/time.js";

const TRACKS = [
  { track: "backend", label: "Backend", short: "BE", glow: "purple" },
  { track: "frontend", label: "Frontend", short: "FE", glow: "green" },
  { track: "android", label: "Android", short: "AN", glow: "cyan" },
];

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;
}

function emptyTrackSummary(meta) {
  return {
    ...meta,
    repos: 0,
    prs: 0,
    reviewEvents: 0,
    crewCount: 0,
    reviewerCount: 0,
    peopleCount: 0,
    avgFirstReviewHours: null,
    avgMissionHours: null,
    avgFirstResponseHours: null,
    avgRereviewHours: null,
    crewActivityByHour: Array.from({ length: 24 }, () => 0),
    reviewerActivityByHour: Array.from({ length: 24 }, () => 0),
    _crewFirstReviewSamples: [],
    _missionSamples: [],
    _reviewerFirstResponseSamples: [],
    _rereviewSamples: [],
    _crewIds: new Set(),
    _reviewerIds: new Set(),
    _peopleIds: new Set(),
  };
}

function sumInto(target, source = []) {
  for (let index = 0; index < target.length; index += 1) {
    target[index] += source[index] ?? 0;
  }
}

function finalizeTrackSummary(summary) {
  summary.crewCount = summary._crewIds.size;
  summary.reviewerCount = summary._reviewerIds.size;
  summary.peopleCount = summary._peopleIds.size;
  summary.avgFirstReviewHours = average(summary._crewFirstReviewSamples);
  summary.avgMissionHours = average(summary._missionSamples);
  summary.avgFirstResponseHours = average(summary._reviewerFirstResponseSamples);
  summary.avgRereviewHours = average(summary._rereviewSamples);

  const {
    _crewFirstReviewSamples,
    _missionSamples,
    _reviewerFirstResponseSamples,
    _rereviewSamples,
    _crewIds,
    _reviewerIds,
    _peopleIds,
    ...serializable
  } = summary;

  return serializable;
}

function buildTrackSummaries(data) {
  const summaries = new Map(TRACKS.map((meta) => [meta.track, emptyTrackSummary(meta)]));

  for (const repo of data?.repositories ?? []) {
    const summary = summaries.get(repo.track);
    if (!summary) continue;

    summary.repos += 1;
    summary.prs += repo.prCount ?? 0;
    summary.reviewEvents += repo.reviewEventCount ?? 0;
  }

  for (const person of data?.people ?? []) {
    const summary = summaries.get(person.track);
    if (!summary) continue;

    summary._peopleIds.add(person.githubId);

    if (person.asCrew?.hasData) {
      summary._crewIds.add(person.githubId);
      sumInto(summary.crewActivityByHour, person.asCrew.activityByHour);
      if (Number.isFinite(person.asCrew.avgFirstReviewHours)) {
        summary._crewFirstReviewSamples.push(person.asCrew.avgFirstReviewHours);
      }
      if (Number.isFinite(person.asCrew.avgMissionHours)) {
        summary._missionSamples.push(person.asCrew.avgMissionHours);
      }
    }

    if (person.asReviewer?.hasData) {
      summary._reviewerIds.add(person.githubId);
      sumInto(summary.reviewerActivityByHour, person.asReviewer.activityByHour);
      if (Number.isFinite(person.asReviewer.avgFirstResponseHours)) {
        summary._reviewerFirstResponseSamples.push(person.asReviewer.avgFirstResponseHours);
      }
      if (Number.isFinite(person.asReviewer.avgRereviewHours)) {
        summary._rereviewSamples.push(person.asReviewer.avgRereviewHours);
      }
    }
  }

  return TRACKS.map((meta) => finalizeTrackSummary(summaries.get(meta.track)));
}

function TrackColumn({ summary }) {
  return (
    <Surface glow={summary.glow} className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-rp-subtle">{summary.short}</p>
          <h2 className="mt-2 text-2xl font-extrabold text-rp-text">{summary.label}</h2>
        </div>
        <span className="rounded-full border border-rp-line bg-rp-panel2 px-3 py-1 text-xs font-semibold text-rp-muted">
          {formatNumber(summary.repos)} repos
        </span>
      </div>

      <div className="mt-6 divide-y divide-rp-line">
        <div className="grid grid-cols-2 gap-4 py-3 first:pt-0">
          <p className="text-xs text-rp-subtle">Closed PRs</p>
          <p className="text-right text-sm font-semibold text-rp-text">{formatNumber(summary.prs)}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 py-3">
          <p className="text-xs text-rp-subtle">Review Events</p>
          <p className="text-right text-sm font-semibold text-rp-text">{formatNumber(summary.reviewEvents)}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 py-3">
          <p className="text-xs text-rp-subtle">Crew / Reviewers</p>
          <p className="text-right text-sm font-semibold text-rp-text">
            {formatNumber(summary.crewCount)} / {formatNumber(summary.reviewerCount)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 py-3">
          <p className="text-xs text-rp-subtle">Avg First Review</p>
          <p className="text-right text-sm font-semibold text-rp-text">{formatHours(summary.avgFirstReviewHours)}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 py-3">
          <p className="text-xs text-rp-subtle">Avg Completion</p>
          <p className="text-right text-sm font-semibold text-rp-text">{formatHours(summary.avgMissionHours)}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 py-3 last:pb-0">
          <p className="text-xs text-rp-subtle">Avg Rereview</p>
          <p className="text-right text-sm font-semibold text-rp-text">{formatHours(summary.avgRereviewHours)}</p>
        </div>
      </div>
    </Surface>
  );
}

function maxBy(rows, key) {
  return rows.reduce((best, row) => {
    if (!best) return row;
    return (row[key] ?? 0) > (best[key] ?? 0) ? row : best;
  }, null);
}

export default function TrackComparePage({ data, loading }) {
  const rows = useMemo(() => buildTrackSummaries(data), [data]);
  const busiestByPr = maxBy(rows, "prs");
  const fastestFirstReview = rows
    .filter((row) => Number.isFinite(row.avgFirstReviewHours))
    .sort((a, b) => a.avgFirstReviewHours - b.avgFirstReviewHours)[0];
  const fastestRereview = rows
    .filter((row) => Number.isFinite(row.avgRereviewHours))
    .sort((a, b) => a.avgRereviewHours - b.avgRereviewHours)[0];

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <AppHeader active="compare" />

      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-12 md:px-[54px]">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold text-rp-purple">TRACK COMPARE</p>
          <h1 className="mt-3 text-[46px] font-extrabold leading-none md:text-[72px]">
            Track Compare
          </h1>
          <p className="mt-6 text-base text-rp-muted">
            BE, FE, AN 트랙의 리뷰 규모와 응답 리듬을 같은 기준으로 비교합니다.
          </p>
        </section>

        <section className="mt-[54px] grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Largest Track" value={loading ? "-" : busiestByPr?.short} note={`${formatNumber(busiestByPr?.prs)} PRs`} glow="purple" />
          <MetricCard title="Fastest First Review" value={loading ? "-" : fastestFirstReview?.short} note={formatHours(fastestFirstReview?.avgFirstReviewHours)} glow="green" />
          <MetricCard title="Fastest Rereview" value={loading ? "-" : fastestRereview?.short} note={formatHours(fastestRereview?.avgRereviewHours)} glow="cyan" />
          <MetricCard title="People" value={formatNumber(rows.reduce((sum, row) => sum + row.peopleCount, 0))} note="members with summary stats" glow="yellow" />
        </section>

        <section className="mt-[58px] grid gap-6 xl:grid-cols-3">
          {rows.map((summary) => (
            <TrackColumn key={summary.track} summary={summary} />
          ))}
        </section>

        <section className="mt-[58px] grid gap-8 xl:grid-cols-2">
          <ActivityBars
            title="Crew Active Hours"
            values={rows.map((row) => row.crewActivityByHour).reduce(
              (merged, values) => merged.map((value, index) => value + (values[index] ?? 0)),
              Array.from({ length: 24 }, () => 0),
            )}
            labels={Array.from({ length: 24 }, (_, hour) => (hour % 3 === 0 ? `${hour}` : ""))}
            glow="cyan"
          />
          <ActivityBars
            title="Reviewer Active Hours"
            values={rows.map((row) => row.reviewerActivityByHour).reduce(
              (merged, values) => merged.map((value, index) => value + (values[index] ?? 0)),
              Array.from({ length: 24 }, () => 0),
            )}
            labels={Array.from({ length: 24 }, (_, hour) => (hour % 3 === 0 ? `${hour}` : ""))}
            glow="green"
          />
        </section>
      </div>
    </main>
  );
}
