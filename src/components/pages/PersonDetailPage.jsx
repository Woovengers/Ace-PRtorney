import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ActivityBars from "../charts/ActivityBars.jsx";
import AppHeader from "../common/AppHeader.jsx";
import HeatmapGrid from "../charts/HeatmapGrid.jsx";
import MetricCard from "../common/MetricCard.jsx";
import SearchBox from "../common/SearchBox.jsx";
import Surface from "../common/Surface.jsx";
import { fetchJson, shouldUseApi } from "../../data/api.js";
import { displayMeta, displayName, isPreferredCrew, personInitial } from "../../utils/person.js";
import { formatHours, formatNumber, formatShortDate } from "../../utils/time.js";

const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => (hour % 3 === 0 ? `${hour}` : ""));
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PR_PAGE_SIZE = 20;
const EMPTY_PR_PAGE = {
  items: [],
  total: 0,
  nextOffset: 0,
  hasMore: false,
};

function firstPersonForMode(people, mode) {
  if (mode === "crew") {
    return (
      people.find((person) => isPreferredCrew(person)) ??
      people.find((person) => person.asCrew?.hasData)
    );
  }

  return people.find((person) => person.asReviewer?.hasData);
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

function PrList({
  title,
  prs,
  total,
  hasMore,
  isLoading,
  error,
  onRetry,
  sentinelRef,
}) {
  return (
    <Surface glow="green" className="p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-extrabold text-rp-text">{title}</h2>
        <p className="text-xs text-rp-subtle">
          {formatNumber(prs.length)} / {formatNumber(total)} loaded
        </p>
      </div>
      <div className="mt-5 divide-y divide-rp-line">
        {prs.map((pr) => (
          <Link
            key={`${pr.repoFullName}#${pr.prNumber}`}
            to={pr.path}
            className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[1fr_280px]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-rp-text">
                #{pr.prNumber} {pr.title}
              </p>
              <p className="mt-1 truncate text-xs text-rp-subtle">
                {pr.repoFullName} · {formatShortDate(pr.createdAt)}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-right text-xs">
              <span className="text-rp-green">first {formatHours(pr.firstReviewHours)}</span>
              <span className="text-rp-yellow">done {formatHours(pr.completionHours)}</span>
              <span className="text-rp-purple">rounds {formatNumber(pr.rounds)}</span>
            </div>
          </Link>
        ))}
      </div>
      {!prs.length && !isLoading && !error ? (
        <p className="mt-5 text-sm text-rp-muted">표시할 PR 목록이 없습니다.</p>
      ) : null}
      {error ? (
        <div className="mt-5 flex flex-col gap-3 rounded-md border border-rp-line bg-rp-panel2 p-4 text-sm text-rp-muted sm:flex-row sm:items-center sm:justify-between">
          <span>PR 목록을 더 불러오지 못했습니다.</span>
          <button
            type="button"
            className="inline-flex w-fit rounded-md border border-rp-line px-3 py-2 text-xs font-semibold text-rp-text transition hover:bg-rp-panel"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      ) : null}
      {isLoading ? (
        <p className="mt-5 text-sm font-semibold text-rp-cyan">Loading PRs...</p>
      ) : null}
      {!isLoading && !error && prs.length > 0 && !hasMore ? (
        <p className="mt-5 text-sm text-rp-muted">All PRs loaded.</p>
      ) : null}
      <div ref={sentinelRef} className="h-8" />
    </Surface>
  );
}

function mergeUniquePrs(current, next) {
  const map = new Map(current.map((pr) => [`${pr.repoFullName}#${pr.prNumber}`, pr]));
  for (const pr of next) {
    map.set(`${pr.repoFullName}#${pr.prNumber}`, pr);
  }
  return [...map.values()];
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
  const [detail, setDetail] = useState(null);
  const [prPage, setPrPage] = useState(EMPTY_PR_PAGE);
  const [isPrLoading, setIsPrLoading] = useState(false);
  const [prError, setPrError] = useState(null);
  const sentinelRef = useRef(null);
  const requestVersionRef = useRef(0);
  const isPrLoadingRef = useRef(false);

  const loadPrPage = useCallback(
    async (offset, { reset = false } = {}) => {
      if (!githubId || !shouldUseApi()) return;
      if (isPrLoadingRef.current) return;

      const requestVersion = reset ? requestVersionRef.current + 1 : requestVersionRef.current;
      if (reset) requestVersionRef.current = requestVersion;
      isPrLoadingRef.current = true;
      setIsPrLoading(true);
      setPrError(null);

      try {
        const params = new URLSearchParams({
          mode,
          limit: String(PR_PAGE_SIZE),
          offset: String(offset),
        });
        const payload = await fetchJson(`/api/people/${githubId}?${params.toString()}`);
        const nextPage = payload.prList ?? EMPTY_PR_PAGE;

        if (requestVersion !== requestVersionRef.current) return;

        setDetail(payload);
        setPrPage((current) => ({
          items: reset ? nextPage.items : mergeUniquePrs(current.items, nextPage.items),
          total: nextPage.total,
          nextOffset: nextPage.nextOffset,
          hasMore: nextPage.hasMore,
        }));
      } catch (error) {
        if (requestVersion === requestVersionRef.current) setPrError(error);
      } finally {
        isPrLoadingRef.current = false;
        if (requestVersion === requestVersionRef.current) {
          setIsPrLoading(false);
        }
      }
    },
    [githubId, mode],
  );

  useEffect(() => {
    requestVersionRef.current += 1;
    setDetail(null);
    setPrPage(EMPTY_PR_PAGE);
    setPrError(null);
    isPrLoadingRef.current = false;
    setIsPrLoading(false);

    if (!githubId || !shouldUseApi()) {
      return () => {
        requestVersionRef.current += 1;
      };
    }

    loadPrPage(0, { reset: true });

    return () => {
      requestVersionRef.current += 1;
    };
  }, [githubId, loadPrPage]);

  useEffect(() => {
    if (!githubId || !shouldUseApi() || !prPage.hasMore || isPrLoading || prError) return;

    function remainingScroll() {
      return document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    }

    function loadNearBottom() {
      const remaining = remainingScroll();
      if (remaining < 720) {
        loadPrPage(prPage.nextOffset);
      }
    }

    function loadIfPageIsTooShort() {
      const remaining = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (remaining < 80) {
        loadPrPage(prPage.nextOffset);
      }
    }

    const frame = window.requestAnimationFrame(loadIfPageIsTooShort);
    window.addEventListener("scroll", loadNearBottom, { passive: true });
    window.addEventListener("resize", loadNearBottom);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", loadNearBottom);
      window.removeEventListener("resize", loadNearBottom);
    };
  }, [githubId, isPrLoading, loadPrPage, prError, prPage.hasMore, prPage.nextOffset]);

  if (loading) return <LoadingState />;
  if (!githubId) return <EmptyState mode={mode} people={people} />;

  const person = data?.peopleMap?.[githubId];
  if (!person) return <NotFound githubId={githubId} />;

  const stats = mode === "crew" ? person.asCrew : person.asReviewer;
  const otherMode = mode === "crew" ? "reviewer" : "crew";
  const glow = mode === "crew" ? "cyan" : "green";
  const title = mode === "crew" ? "Crew Pace" : "Reviewer Rhythm";
  const hasData = Boolean(stats?.hasData);
  const searchSelection = selectedPerson?.githubId === person.githubId ? selectedPerson : person;
  const fallbackPrs = mode === "crew" ? detail?.recentCrewPrs : detail?.recentReviewedPrs;
  const listedPrs = shouldUseApi() ? prPage.items : (fallbackPrs ?? []);
  const listedTotal = shouldUseApi() ? prPage.total : listedPrs.length;

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <AppHeader active={mode} personGithubId={person.githubId} />

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
            selectedPerson={searchSelection}
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

        <section className="mt-[58px]">
          <PrList
            title={mode === "crew" ? "Crew PRs" : "Reviewed PRs"}
            prs={listedPrs}
            total={listedTotal}
            hasMore={prPage.hasMore}
            isLoading={isPrLoading}
            error={prError}
            onRetry={() => loadPrPage(prPage.nextOffset)}
            sentinelRef={sentinelRef}
          />
        </section>
      </div>
    </main>
  );
}
