import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MetricCard from "../common/MetricCard.jsx";
import SearchBox from "../common/SearchBox.jsx";
import Surface from "../common/Surface.jsx";
import AvatarMarquee from "../marquee/AvatarMarquee.jsx";
import TrackDistribution from "../charts/TrackDistribution.jsx";
import { cn } from "../../utils/classNames.js";
import { formatNumber, formatShortDate } from "../../utils/time.js";

const TRACK_FILTERS = [
  { label: "All", value: "all" },
  { label: "Backend", value: "backend" },
  { label: "Frontend", value: "frontend" },
  { label: "Android", value: "android" },
];

function SkeletonCard() {
  return (
    <Surface className="h-32 animate-pulse p-5">
      <div className="h-3 w-24 rounded bg-rp-line" />
      <div className="mt-5 h-8 w-32 rounded bg-rp-line" />
      <div className="mt-6 h-3 w-36 rounded bg-rp-line" />
    </Surface>
  );
}

export default function OverviewPage({
  data,
  loading,
  people,
  selectedPerson,
  onSelectPerson,
  onNavigate,
}) {
  const [trackFilter, setTrackFilter] = useState("all");
  const summary = data?.summary;
  const recentActivity = data?.recentActivity;

  const filteredCrew = useMemo(
    () =>
      (recentActivity?.crew ?? []).filter(
        (item) => trackFilter === "all" || item.track === trackFilter,
      ),
    [recentActivity, trackFilter],
  );
  const filteredReviewers = useMemo(
    () =>
      (recentActivity?.reviewers ?? []).filter(
        (item) => trackFilter === "all" || item.track === trackFilter,
      ),
    [recentActivity, trackFilter],
  );

  function handlePersonClick(item) {
    onNavigate(item.role === "reviewer" ? "reviewer" : "crew", item);
  }

  function handleSearchNavigate(person) {
    onNavigate(person.asCrew?.hasData ? "crew" : "reviewer", person);
  }

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <header className="sticky top-0 z-30 border-b border-rp-line/70 bg-rp-bg/92 backdrop-blur">
        <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center px-6 md:px-12">
          <Link to="/" className="text-lg font-extrabold">
            Review Pace
          </Link>
          <nav className="ml-auto hidden items-center gap-5 text-[13px] text-rp-subtle md:flex">
            <Link to="/" className="font-semibold text-rp-text">Overview</Link>
            <Link to="/crew" className="hover:text-rp-text">Crew</Link>
            <Link to="/reviewer" className="hover:text-rp-text">Reviewers</Link>
            <Link to="/missions" className="hover:text-rp-text">Missions</Link>
            <Link to="/matches" className="hover:text-rp-text">Match</Link>
            <span>PRs</span>
          </nav>
        </div>
      </header>

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
            selectedPerson={selectedPerson}
            onSelectPerson={onSelectPerson}
            onPersonNavigate={handleSearchNavigate}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {TRACK_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-semibold transition",
                  trackFilter === filter.value
                    ? "border-rp-purple bg-rp-purple text-white shadow-glow-purple"
                    : "border-rp-line bg-rp-panel text-rp-muted hover:text-rp-text",
                )}
                onClick={() => setTrackFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
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
            onClick={() => onNavigate("crew", selectedPerson)}
          />
          <MetricCard
            title="Reviewer Rhythm"
            value="리뷰어"
            note="상세 분석으로 이동"
            glow="green"
            onClick={() => onNavigate("reviewer", selectedPerson)}
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
