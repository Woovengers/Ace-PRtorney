import { Link, Navigate, useParams } from "react-router-dom";
import ActivityBars from "../charts/ActivityBars.jsx";
import HeatmapGrid from "../charts/HeatmapGrid.jsx";
import MetricCard from "../common/MetricCard.jsx";
import SearchBox from "../common/SearchBox.jsx";
import Surface from "../common/Surface.jsx";
import { displayMeta, displayName, personInitial } from "../../utils/person.js";
import { formatHours, formatNumber } from "../../utils/time.js";

const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => (hour % 3 === 0 ? `${hour}` : ""));
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function firstPersonForMode(people, mode) {
  return people.find((person) =>
    mode === "crew" ? person.asCrew?.hasData : person.asReviewer?.hasData,
  );
}

function EmptyState({ mode, people }) {
  const fallback = firstPersonForMode(people, mode);

  if (fallback) {
    return <Navigate to={`/${mode}/${fallback.githubId}`} replace />;
  }

  return (
    <main className="page-grid grid min-h-screen place-items-center px-6 text-rp-text">
      <Surface className="max-w-lg p-6">
        <p className="text-xs font-semibold text-rp-purple">NO DATA</p>
        <h1 className="mt-3 text-2xl font-extrabold">표시할 상세 데이터가 없습니다.</h1>
        <Link className="mt-5 inline-flex text-sm font-semibold text-rp-cyan" to="/">
          Overview로 돌아가기
        </Link>
      </Surface>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="page-grid min-h-screen px-6 py-24 text-rp-text md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <Surface className="h-48 animate-pulse" />
        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <Surface className="h-32 animate-pulse" />
          <Surface className="h-32 animate-pulse" />
          <Surface className="h-32 animate-pulse" />
          <Surface className="h-32 animate-pulse" />
        </div>
      </div>
    </main>
  );
}

function NotFound({ githubId }) {
  return (
    <main className="page-grid grid min-h-screen place-items-center px-6 text-rp-text">
      <Surface glow="yellow" className="max-w-lg p-6">
        <p className="text-xs font-semibold text-rp-yellow">PERSON NOT FOUND</p>
        <h1 className="mt-3 text-2xl font-extrabold">@{githubId} 데이터를 찾지 못했습니다.</h1>
        <Link className="mt-5 inline-flex text-sm font-semibold text-rp-cyan" to="/">
          Overview로 돌아가기
        </Link>
      </Surface>
    </main>
  );
}

function StatNarrative({ mode, stats }) {
  if (mode === "crew") {
    return (
      <Surface glow="cyan" className="p-5">
        <h2 className="text-base font-extrabold text-rp-text">Crew Pace Summary</h2>
        <div className="mt-5 grid gap-4 text-sm text-rp-muted sm:grid-cols-2">
          <p>
            평균 첫 리뷰 대기 시간은{" "}
            <span className="font-semibold text-rp-cyan">{formatHours(stats.avgFirstReviewHours)}</span>
            입니다.
          </p>
          <p>
            변경 요청 후 첫 응답까지 평균{" "}
            <span className="font-semibold text-rp-green">{formatHours(stats.avgReRequestHours)}</span>
            이 걸립니다.
          </p>
        </div>
      </Surface>
    );
  }

  return (
    <Surface glow="green" className="p-5">
      <h2 className="text-base font-extrabold text-rp-text">Reviewer Rhythm Summary</h2>
      <div className="mt-5 grid gap-4 text-sm text-rp-muted sm:grid-cols-2">
        <p>
          평균 첫 응답 시간은{" "}
          <span className="font-semibold text-rp-green">{formatHours(stats.avgFirstResponseHours)}</span>
          입니다.
        </p>
        <p>
          변경 요청 이후 재리뷰까지 평균{" "}
          <span className="font-semibold text-rp-purple">{formatHours(stats.avgRereviewHours)}</span>
          이 걸립니다.
        </p>
      </div>
    </Surface>
  );
}

export default function PersonDetailPage({
  data,
  loading,
  mode,
  people,
  selectedPerson,
  onSelectPerson,
  onNavigate,
}) {
  const { githubId } = useParams();

  if (loading) return <LoadingState />;
  if (!githubId) return <EmptyState mode={mode} people={people} />;

  const person = data?.peopleMap?.[githubId];
  if (!person) return <NotFound githubId={githubId} />;

  const stats = mode === "crew" ? person.asCrew : person.asReviewer;
  const otherMode = mode === "crew" ? "reviewer" : "crew";
  const glow = mode === "crew" ? "cyan" : "green";
  const title = mode === "crew" ? "Crew Pace" : "Reviewer Rhythm";
  const hasData = Boolean(stats?.hasData);

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <header className="sticky top-0 z-30 border-b border-rp-line/70 bg-rp-bg/92 backdrop-blur">
        <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center px-6 md:px-12">
          <Link to="/" className="text-lg font-extrabold">
            Review Pace
          </Link>
          <nav className="ml-auto hidden items-center gap-5 text-[13px] text-rp-subtle md:flex">
            <Link to="/" className="hover:text-rp-text">Overview</Link>
            <Link to={`/crew/${person.githubId}`} className={mode === "crew" ? "font-semibold text-rp-text" : "hover:text-rp-text"}>Crew</Link>
            <Link to={`/reviewer/${person.githubId}`} className={mode === "reviewer" ? "font-semibold text-rp-text" : "hover:text-rp-text"}>Reviewers</Link>
            <span>Missions</span>
            <span>Match</span>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-10 md:px-[54px]">
        <div className="max-w-3xl">
          <Link to="/" className="text-xs font-semibold text-rp-subtle transition hover:text-rp-text">
            Overview
          </Link>
          <p className="mt-5 text-xs font-semibold text-rp-purple">WOOWACOURSE REVIEW ANALYTICS</p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border border-rp-line bg-rp-panel2 text-3xl font-extrabold text-rp-text shadow-glow-purple">
              {person.avatarUrl ? (
                <img
                  src={person.avatarUrl}
                  alt=""
                  className="h-full w-full rounded-lg object-cover"
                  loading="lazy"
                />
              ) : (
                personInitial(person)
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-[42px] font-extrabold leading-none md:text-[64px]">
                {title}
              </h1>
              <p className="mt-3 text-base text-rp-muted">
                {displayName(person)} · {displayMeta(person)}
              </p>
            </div>
          </div>
        </div>

        <section className="mt-8 max-w-3xl">
          <SearchBox
            people={people}
            selectedPerson={selectedPerson ?? person}
            onSelectPerson={onSelectPerson}
            onPersonNavigate={(nextPerson) => onNavigate(mode, nextPerson)}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={`/crew/${person.githubId}`}
              className="rounded-full border border-rp-line bg-rp-panel px-4 py-2 text-xs font-semibold text-rp-muted transition hover:text-rp-text"
            >
              Crew View
            </Link>
            <Link
              to={`/reviewer/${person.githubId}`}
              className="rounded-full border border-rp-line bg-rp-panel px-4 py-2 text-xs font-semibold text-rp-muted transition hover:text-rp-text"
            >
              Reviewer View
            </Link>
            <button
              type="button"
              className="rounded-full border border-rp-line bg-rp-panel px-4 py-2 text-xs font-semibold text-rp-muted transition hover:text-rp-text"
              onClick={() => onNavigate(otherMode, person)}
            >
              Switch Role
            </button>
          </div>
        </section>

        {!hasData ? (
          <Surface glow="yellow" className="mt-10 p-6">
            <p className="text-sm font-semibold text-rp-yellow">NO ROLE DATA</p>
            <p className="mt-3 text-sm text-rp-muted">
              이 사람은 현재 {mode === "crew" ? "크루" : "리뷰어"} 기준 통계가 없습니다.
            </p>
          </Surface>
        ) : null}

        <section className="mt-[54px] grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {mode === "crew" ? (
            <>
              <MetricCard title="Total PRs" value={formatNumber(stats.totalPRs)} note="작성한 closed / merged PR" glow={glow} />
              <MetricCard title="First Review" value={formatHours(stats.avgFirstReviewHours)} note="PR 생성 후 첫 리뷰" glow="green" />
              <MetricCard title="Re-request" value={formatHours(stats.avgReRequestHours)} note="변경 요청 후 crew 응답" glow="purple" />
              <MetricCard title="Completion" value={formatHours(stats.avgMissionHours)} note="PR 생성부터 종료까지" glow="yellow" />
            </>
          ) : (
            <>
              <MetricCard title="Reviewed PRs" value={formatNumber(stats.reviewedPRs)} note="리뷰한 고유 PR" glow={glow} />
              <MetricCard title="Review Events" value={formatNumber(stats.reviewEvents)} note="review submission" glow="purple" />
              <MetricCard title="First Response" value={formatHours(stats.avgFirstResponseHours)} note="PR 생성 후 첫 리뷰" glow="cyan" />
              <MetricCard title="Rereview" value={formatHours(stats.avgRereviewHours)} note="변경 요청 후 다음 리뷰" glow="yellow" />
            </>
          )}
        </section>

        <section className="mt-[58px] grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ActivityBars
            title="Active Hours"
            values={stats.activityByHour ?? []}
            labels={HOUR_LABELS}
            glow={glow}
          />
          <ActivityBars
            title="Weekday Rhythm"
            values={stats.activityByWeekday ?? []}
            labels={WEEKDAY_LABELS}
            glow="purple"
          />
        </section>

        <section className="mt-[58px] grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <HeatmapGrid title="KST Activity Heatmap" values={stats.activityHeatmap ?? []} glow={glow} />
          <StatNarrative mode={mode} stats={stats} />
        </section>
      </div>
    </main>
  );
}
