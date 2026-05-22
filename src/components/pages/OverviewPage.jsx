import { useMemo } from "react";
import AppHeader from "../common/AppHeader.jsx";
import MetricCard from "../common/MetricCard.jsx";
import SearchBox from "../common/SearchBox.jsx";
import Surface from "../common/Surface.jsx";
import AvatarMarquee from "../marquee/AvatarMarquee.jsx";
import TrackDistribution from "../charts/TrackDistribution.jsx";
import { formatNumber, formatShortDate } from "../../utils/time.js";

function SkeletonCard() {
  return (
    <Surface className="h-32 animate-pulse p-5">
      <div className="h-3 w-24 rounded bg-rp-line" />
      <div className="mt-5 h-8 w-32 rounded bg-rp-line" />
      <div className="mt-6 h-3 w-36 rounded bg-rp-line" />
    </Surface>
  );
}

function uniquePeopleByGithubId(items) {
  const uniqueItems = new Map();

  for (const item of items) {
    if (!uniqueItems.has(item.githubId)) uniqueItems.set(item.githubId, item);
  }

  return [...uniqueItems.values()];
}

function roleRouteForPerson(person) {
  const crewTime = person?.asCrew?.latestCrewActivityAt
    ? new Date(person.asCrew.latestCrewActivityAt).getTime()
    : null;
  const reviewerTime = person?.asReviewer?.latestReviewAt
    ? new Date(person.asReviewer.latestReviewAt).getTime()
    : null;

  if (Number.isFinite(crewTime) && Number.isFinite(reviewerTime)) {
    return reviewerTime > crewTime ? "reviewer" : "crew";
  }
  if (Number.isFinite(reviewerTime)) return "reviewer";
  if (Number.isFinite(crewTime)) return "crew";
  return person.asCrew?.hasData ? "crew" : "reviewer";
}

export default function OverviewPage({
  data,
  loading,
  people,
  onSelectPerson,
  onNavigate,
}) {
  const summary = data?.summary;
  const recentActivity = data?.recentActivity;

  const filteredCrew = useMemo(
    () => uniquePeopleByGithubId(recentActivity?.crew ?? []),
    [recentActivity],
  );
  const filteredReviewers = useMemo(
    () => uniquePeopleByGithubId(recentActivity?.reviewers ?? []),
    [recentActivity],
  );

  function handlePersonClick(item) {
    onNavigate(item.role === "reviewer" ? "reviewer" : "crew", item);
  }

  function handleSearchNavigate(person) {
    onNavigate(roleRouteForPerson(person), person);
  }

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <AppHeader active="overview" />

      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-12 md:px-[54px]">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold text-rp-purple">WOOWACOURSE REVIEW ANALYTICS</p>
          <h1 className="mt-3 text-[54px] font-extrabold leading-none text-rp-text md:text-[78px]">
            Review Pace
          </h1>
          <p className="mt-6 text-base text-rp-muted">
            우테코 PR 리뷰 흐름을 탐색하는 대시보드입니다.
          </p>
        </section>

        <section className="mt-8 max-w-3xl">
          <SearchBox
            people={people}
            onSelectPerson={onSelectPerson}
            onPersonNavigate={handleSearchNavigate}
          />
        </section>

        <section className="mt-[54px] grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <MetricCard
                title="Closed PRs"
                value={formatNumber(summary.totalPRs)}
                note="closed / merged PR"
                glow="purple"
              />
              <MetricCard
                title="Review Events"
                value={formatNumber(summary.totalReviewEvents)}
                note="review submissions"
                glow="green"
              />
              <MetricCard
                title="Repositories"
                value={formatNumber(summary.totalRepos)}
                note={`active ${formatNumber(summary.activeRepos)} · BE · FE · AN`}
                glow="cyan"
              />
              <MetricCard
                title="People"
                value={`${formatNumber(summary.totalMembers)}+`}
                note={`members + ${formatNumber(summary.totalPeople - summary.totalMembers)} fallback`}
                glow="yellow"
              />
            </>
          )}
        </section>

        <section className="mt-[58px] grid gap-8 xl:grid-cols-2">
          {loading ? (
            <>
              <Surface className="h-[210px] animate-pulse" />
              <Surface className="h-[210px] animate-pulse" />
            </>
          ) : (
            <>
              <AvatarMarquee
                title="Recently Active Crew"
                subtitle="최근 제출/재요청 활동"
                items={filteredCrew}
                direction="right"
                glow="green"
                onItemClick={handlePersonClick}
              />
              <AvatarMarquee
                title="Recently Active Reviewers"
                subtitle="최근 첫 리뷰/재리뷰 활동"
                items={filteredReviewers}
                direction="right"
                glow="purple"
                onItemClick={handlePersonClick}
              />
            </>
          )}
        </section>

        <section className="mt-[58px] grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Crew Pace"
            value="크루"
            note="상세 분석으로 이동"
            glow="cyan"
            onClick={() => onNavigate("crew")}
          />
          <MetricCard
            title="Reviewer Rhythm"
            value="리뷰어"
            note="상세 분석으로 이동"
            glow="green"
            onClick={() => onNavigate("reviewer")}
          />
          <MetricCard
            title="Mission Board"
            value="미션"
            note="상세 분석으로 이동"
            glow="purple"
            onClick={() => onNavigate("missions")}
          />
          <MetricCard
            title="Track Compare"
            value="트랙"
            note="상세 분석으로 이동"
            glow="yellow"
            onClick={() => onNavigate("compare")}
          />
        </section>

        <section className="mt-[58px] grid gap-8 xl:grid-cols-[minmax(0,624px)_300px]">
          {loading ? (
            <>
              <Surface className="h-36 animate-pulse" />
              <Surface className="h-32 animate-pulse" />
            </>
          ) : (
            <>
              <TrackDistribution rows={summary.trackDistribution} />
              <MetricCard
                title="Data Freshness"
                value={formatShortDate(summary.sourceGeneratedAt)}
                note={`members ${formatNumber(summary.totalMembers)} · PR ${formatNumber(summary.totalPRs)}`}
                glow="cyan"
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
