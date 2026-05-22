import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ActivityBars from "../charts/ActivityBars.jsx";
import AppHeader from "../common/AppHeader.jsx";
import MatchModeTabs from "../common/MatchModeTabs.jsx";
import MetricCard from "../common/MetricCard.jsx";
import SearchBox from "../common/SearchBox.jsx";
import Surface from "../common/Surface.jsx";
import MatchScoreBreakdown from "../match/MatchScoreBreakdown.jsx";
import { fetchJson, shouldUseApi } from "../../data/api.js";
import { calculateReviewerMatches } from "../../utils/reviewerMatch.js";
import { displayMeta, displayName, isPreferredCrew, personInitial } from "../../utils/person.js";
import { formatHours, formatNumber } from "../../utils/time.js";

function firstCrew(people) {
  return people.find((person) => isPreferredCrew(person)) ?? people.find((person) => person.asCrew?.hasData);
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

function recentReferenceLabel(recentReferenceAt) {
  if (!recentReferenceAt) return "최근 기준일 없음";
  return `최근 기준일 ${new Date(recentReferenceAt).toLocaleDateString("ko-KR")}`;
}

function ScoreBar({ label, value, glow = "purple" }) {
  const color =
    glow === "green"
      ? "bg-rp-green"
      : glow === "cyan"
        ? "bg-rp-cyan"
        : glow === "yellow"
          ? "bg-rp-yellow"
          : "bg-rp-purple";

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="text-rp-subtle">{label}</span>
        <span className="font-semibold text-rp-text">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-rp-panel2">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MatchLanding({ crewPeople, onSelectPerson, onNavigate }) {
  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <AppHeader active="match" />

      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-12 md:px-[54px]">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold text-rp-purple">REVIEWER MATCH</p>
          <h1 className="mt-3 text-[46px] font-extrabold leading-none md:text-[72px]">
            Reviewer Match
          </h1>
          <p className="mt-6 text-base text-rp-muted">
            크루를 검색해 최근 한 달 동안 리뷰 활동이 있는 같은 트랙 리뷰어를 추천받거나,
            후보 리뷰어를 직접 추가해 비교하세요.
          </p>
          <MatchModeTabs active="auto" />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <SearchBox
              people={crewPeople}
              onSelectPerson={onSelectPerson}
              onPersonNavigate={(person) => onNavigate("matches", person)}
            />
          </div>
          <Surface glow="green" className="p-5">
            <h2 className="text-base font-extrabold text-rp-text">Candidate Compare</h2>
            <p className="mt-3 text-sm text-rp-muted">
              크루와 후보 리뷰어를 직접 고르고 같은 기준으로 점수를 비교합니다.
            </p>
            <Link
              to="/matches/compare"
              className="mt-5 inline-flex rounded-md border border-rp-line bg-rp-panel2 px-4 py-3 text-sm font-semibold text-rp-text transition hover:bg-rp-panel"
            >
              후보 직접 비교
            </Link>
          </Surface>
        </section>
      </div>
    </main>
  );
}

function ReviewerCard({ match, rank }) {
  const { reviewer, scores } = match;

  return (
    <Surface glow={rank === 1 ? "green" : "purple"} className="p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-rp-line bg-rp-panel2 text-xl font-extrabold text-rp-text">
            {reviewer.avatarUrl ? (
              <img src={reviewer.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              personInitial(reviewer)
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-rp-green">#{rank}</span>
              <span className="text-xs text-rp-subtle">{displayMeta(reviewer)}</span>
            </div>
            <h2 className="mt-2 truncate text-xl font-extrabold text-rp-text">{displayName(reviewer)}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {match.reasons.map((reason) => (
                <span
                  key={reason}
                  className="rounded-full border border-rp-line bg-rp-panel2 px-2 py-1 text-[10px] font-semibold text-rp-muted"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:min-w-[320px]">
          <p className="text-right text-[38px] font-extrabold leading-none text-rp-green">{match.score}</p>
          <p className="mt-1 text-right text-xs text-rp-subtle">매칭 점수</p>
        </div>
      </div>

      <MatchScoreBreakdown scores={scores} />

      <div className="mt-6 grid gap-4 border-t border-rp-line pt-5 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold text-rp-cyan">
            {formatHours(reviewer.asReviewer.avgFirstResponseHours)}
          </p>
          <p className="mt-1 text-[10px] text-rp-subtle">첫 리뷰 응답</p>
        </div>
        <div>
          <p className="text-lg font-extrabold text-rp-purple">
            {formatHours(reviewer.asReviewer.avgRereviewHours)}
          </p>
          <p className="mt-1 text-[10px] text-rp-subtle">재리뷰 중앙값</p>
        </div>
        <div>
          <p className="text-lg font-extrabold text-rp-yellow">
            {formatNumber(reviewer.asReviewer.reviewEvents)}
          </p>
          <p className="mt-1 text-[10px] text-rp-subtle">리뷰 이벤트</p>
        </div>
      </div>
    </Surface>
  );
}

export default function ReviewerMatchPage({
  data,
  loading,
  people,
  selectedPerson,
  onSelectPerson,
  onNavigate,
}) {
  const { githubId } = useParams();
  const [limit, setLimit] = useState(8);
  const [serverMatches, setServerMatches] = useState(null);
  const [serverRecentReferenceAt, setServerRecentReferenceAt] = useState(null);
  const crewPeople = people.filter((person) => person.asCrew?.hasData);
  const crew = githubId ? data?.peopleMap?.[githubId] : null;
  const recentReferenceAt =
    serverRecentReferenceAt ??
    data?.recentReferenceAt ??
    data?.summary?.recentReferenceAt ??
    data?.summary?.sourceGeneratedAt ??
    data?.summary?.latestActivityAt ??
    null;

  useEffect(() => {
    let cancelled = false;
    setServerMatches(null);
    setServerRecentReferenceAt(null);

    if (!crew?.githubId || !shouldUseApi()) {
      return () => {
        cancelled = true;
      };
    }

    fetchJson(`/api/matches/${crew.githubId}`)
      .then((payload) => {
        if (!cancelled) {
          setServerMatches(payload.matches ?? null);
          setServerRecentReferenceAt(payload.recentReferenceAt ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setServerMatches(null);
      });

    return () => {
      cancelled = true;
    };
  }, [crew?.githubId]);

  if (loading) return <LoadingState />;
  if (!githubId) {
    return (
      <MatchLanding
        crewPeople={crewPeople}
        onSelectPerson={onSelectPerson}
        onNavigate={onNavigate}
      />
    );
  }
  if (!crew) return <Navigate to="/" replace />;

  const matches = serverMatches ?? calculateReviewerMatches(crew, people, {
    sameTrackOnly: true,
    requireRecentReviewerActivity: true,
    recentReferenceAt,
  });
  const visibleMatches = matches.slice(0, limit);
  const topMatch = matches[0];

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <AppHeader active="match" />

      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-12 md:px-[54px]">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold text-rp-purple">REVIEWER MATCH</p>
          <h1 className="mt-3 text-[46px] font-extrabold leading-none md:text-[72px]">
            Reviewer Match
          </h1>
          <p className="mt-6 text-base text-rp-muted">
            크루의 활동 리듬과 리뷰어의 응답 패턴을 비교해 리뷰어 후보를 추천합니다.
          </p>
          <p className="mt-3 text-sm text-rp-subtle">
            리뷰 품질이 아닌 활동 시간대와 응답 이력을 기준으로 한 추천입니다. {recentReferenceLabel(recentReferenceAt)}
          </p>
          <MatchModeTabs active="auto" autoHref={`/matches/${crew.githubId}`} />
        </section>

        <section className="mt-8 max-w-3xl">
          <SearchBox
            people={crewPeople}
            selectedPerson={
              selectedPerson?.asCrew?.hasData && selectedPerson.githubId === crew.githubId
                ? selectedPerson
                : crew
            }
            onSelectPerson={onSelectPerson}
            onPersonNavigate={(person) => onNavigate("matches", person)}
          />
        </section>

        <section className="mt-[54px] grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="선택한 크루" value={displayName(crew)} note={displayMeta(crew)} glow="cyan" />
          <MetricCard title="후보" value={formatNumber(matches.length)} note="최근 활동이 있는 같은 트랙 리뷰어" glow="purple" />
          <MetricCard title="최고 매칭" value={topMatch?.reviewer ? displayName(topMatch.reviewer) : "-"} note={topMatch ? `${topMatch.score}점` : "후보 없음"} glow="green" />
          <MetricCard title="크루 PR" value={formatNumber(crew.asCrew?.totalPRs)} note={`첫 리뷰 ${formatHours(crew.asCrew?.avgFirstReviewHours)}`} glow="yellow" />
        </section>

        <section className="mt-[58px] grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ActivityBars
            title="Crew Active Hours"
            values={crew.asCrew?.activityByHour ?? []}
            labels={Array.from({ length: 24 }, (_, hour) => (hour % 3 === 0 ? `${hour}` : ""))}
            glow="cyan"
          />
          <Surface glow="purple" className="p-5">
            <h2 className="text-base font-extrabold text-rp-text">점수 반영 비율</h2>
            <div className="mt-5 space-y-4">
              <ScoreBar label="활동 시간대 궁합" value={40} glow="cyan" />
              <ScoreBar label="첫 리뷰 응답" value={25} glow="green" />
              <ScoreBar label="크루 응답 후 재리뷰" value={20} glow="purple" />
              <ScoreBar label="같은 트랙" value={10} glow="yellow" />
              <ScoreBar label="최근 리뷰 활동" value={5} glow="green" />
            </div>
          </Surface>
        </section>

        <section className="mt-[58px] grid gap-4">
          {visibleMatches.length > 0 ? (
            visibleMatches.map((match, index) => (
              <ReviewerCard key={match.reviewer.githubId} match={match} rank={index + 1} />
            ))
          ) : (
            <Surface glow="yellow" className="p-6">
              <p className="text-sm font-semibold text-rp-yellow">NO RECENT MATCHES</p>
              <p className="mt-3 text-sm text-rp-muted">
                최근 30일 리뷰 활동이 있는 같은 트랙 리뷰어가 없습니다.
              </p>
            </Surface>
          )}
        </section>

        {limit < matches.length ? (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              className="rounded-full border border-rp-line bg-rp-panel px-5 py-3 text-sm font-semibold text-rp-muted transition hover:text-rp-text"
              onClick={() => setLimit((value) => value + 8)}
            >
              후보 더 보기
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
