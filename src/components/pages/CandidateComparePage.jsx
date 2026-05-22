import { useMemo, useState } from "react";
import AppHeader from "../common/AppHeader.jsx";
import MatchModeTabs from "../common/MatchModeTabs.jsx";
import MetricCard from "../common/MetricCard.jsx";
import SearchBox from "../common/SearchBox.jsx";
import Surface from "../common/Surface.jsx";
import MatchScoreBreakdown from "../match/MatchScoreBreakdown.jsx";
import { fetchJson, shouldUseApi } from "../../data/api.js";
import { compareReviewerCandidates } from "../../utils/reviewerMatch.js";
import { displayMeta, displayName } from "../../utils/person.js";
import { formatHours, formatNumber } from "../../utils/time.js";

function candidateLabel(person) {
  return displayName(person);
}

function recentReferenceLabel(recentReferenceAt) {
  if (!recentReferenceAt) return "최근 기준일 없음";
  return `최근 기준일 ${new Date(recentReferenceAt).toLocaleDateString("ko-KR")}`;
}

function trackName(track) {
  if (track === "backend") return "백엔드";
  if (track === "frontend") return "프론트엔드";
  if (track === "android") return "안드로이드";
  return track ?? "트랙 정보 없음";
}

function excludedReasonLabel(reason) {
  if (reason === "no reviewer data") return "리뷰어 활동 데이터 없음";
  if (reason === "no recent reviewer activity") return "최근 30일 리뷰 활동 없음";
  if (reason === "different track") return "크루와 다른 트랙";
  return reason ?? "제외됨";
}

export default function CandidateComparePage({ data, people, onSelectPerson }) {
  const crewPeople = people.filter((person) => person.asCrew?.hasData);
  const reviewerPeople = people.filter((person) => person.asReviewer?.hasData);
  const [crew, setCrew] = useState(null);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidateIds, setCandidateIds] = useState([]);
  const [apiResult, setApiResult] = useState(null);
  const [apiError, setApiError] = useState(null);
  const recentReferenceAt =
    apiResult?.recentReferenceAt ??
    data?.recentReferenceAt ??
    data?.summary?.recentReferenceAt ??
    data?.summary?.sourceGeneratedAt ??
    data?.summary?.latestActivityAt ??
    null;

  const candidateMatches = useMemo(
    () => compareReviewerCandidates(crew, people, candidateIds, {
      requireRecentReviewerActivity: true,
      recentReferenceAt,
    }),
    [crew, people, candidateIds, recentReferenceAt],
  );
  const result = apiResult ?? { crew, ...candidateMatches };
  const peopleByGithubId = useMemo(
    () => new Map(people.map((person) => [person.githubId, person])),
    [people],
  );
  const candidateSuggestions = reviewerPeople
    .filter((person) => {
      const query = candidateQuery.trim().toLowerCase();
      if (!query || candidateIds.includes(person.githubId)) return false;
      return [person.githubId, person.nickname, person.displayName, person.track]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .slice(0, 6);

  function addCandidate(person) {
    setCandidateIds((ids) => [...new Set([...ids, person.githubId])]);
    setCandidateQuery("");
    setApiResult(null);
  }

  function removeCandidate(githubId) {
    setCandidateIds((ids) => ids.filter((id) => id !== githubId));
    setApiResult(null);
  }

  function selectedCandidateName(githubId) {
    return displayName(peopleByGithubId.get(githubId) ?? { githubId });
  }

  function excludedCandidateName(candidate) {
    return displayName(peopleByGithubId.get(candidate.githubId) ?? candidate);
  }

  async function runApiCompare() {
    setApiError(null);
    setApiResult(null);
    if (!crew || candidateIds.length === 0 || !shouldUseApi()) return;

    try {
      const data = await fetchJson("/api/matches/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewGithubId: crew.githubId,
          candidateReviewerGithubIds: candidateIds,
        }),
      });
      setApiResult(data);
    } catch (error) {
      setApiError(error);
    }
  }

  if (crewPeople.length === 0) {
    return (
      <main className="page-grid grid min-h-screen place-items-center px-6 text-rp-text">
        <Surface glow="yellow" className="max-w-lg p-6">
          <p className="text-xs font-semibold text-rp-yellow">NO CREW DATA</p>
          <h1 className="mt-3 text-2xl font-extrabold">비교할 크루 데이터가 없습니다.</h1>
        </Surface>
      </main>
    );
  }

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <AppHeader active="match" />

      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-12 md:px-[54px]">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold text-rp-purple">후보 직접 비교</p>
          <h1 className="mt-3 text-[46px] font-extrabold leading-none md:text-[72px]">
            리뷰어 후보 비교
          </h1>
          <p className="mt-6 text-base text-rp-muted">
            특정 크루에게 후보 리뷰어를 직접 넣고, 같은 기준으로 점수를 비교합니다.
          </p>
          <p className="mt-3 text-sm text-rp-subtle">
            최근 30일 리뷰 활동이 없는 후보와 다른 트랙 후보는 제외됩니다. {recentReferenceLabel(recentReferenceAt)}
          </p>
          <MatchModeTabs
            active="compare"
            autoHref={crew ? `/matches/${crew.githubId}` : "/matches"}
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <SearchBox
              people={crewPeople}
              selectedPerson={crew}
              onSelectPerson={(person) => {
                setCrew(person);
                onSelectPerson(person);
                setApiResult(null);
              }}
            />
            <Surface glow="cyan" className="relative z-0 mt-4 p-2">
              <label className="sr-only" htmlFor="candidate-search">후보 리뷰어 검색</label>
              <input
                id="candidate-search"
                value={candidateQuery}
                onChange={(event) => setCandidateQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setCandidateQuery("");
                    event.currentTarget.blur();
                    return;
                  }

                  if (event.key === "Enter" && candidateQuery.trim() && candidateSuggestions.length > 0) {
                    event.preventDefault();
                    addCandidate(candidateSuggestions[0]);
                  }
                }}
                placeholder="후보 리뷰어 닉네임 또는 GitHub ID 검색"
                className="min-h-12 w-full rounded-md border border-rp-line bg-rp-bg px-4 text-sm text-rp-text outline-none transition focus:border-rp-cyan"
              />
              {candidateSuggestions.length > 0 ? (
                <div className="absolute left-2 right-2 top-[calc(100%+8px)] z-20 overflow-hidden rounded-lg border border-rp-line bg-rp-panel shadow-glow-cyan">
                  {candidateSuggestions.map((person) => (
                    <button
                      key={person.githubId}
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-rp-panel2"
                      onClick={() => addCandidate(person)}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-rp-text">{candidateLabel(person)}</span>
                        <span className="text-xs text-rp-subtle">{displayMeta(person)}</span>
                      </span>
                      <span className="text-xs text-rp-subtle">{trackName(person.track)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </Surface>
          </div>

          <Surface glow="purple" className="p-5">
            <h2 className="text-base font-extrabold text-rp-text">선택한 후보</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {candidateIds.length === 0 ? (
                <p className="text-sm text-rp-muted">후보 리뷰어를 추가하세요.</p>
              ) : (
                candidateIds.map((githubId) => (
                  <button
                    key={githubId}
                    type="button"
                    className="rounded-full border border-rp-line bg-rp-panel2 px-3 py-2 text-xs font-semibold text-rp-muted transition hover:text-rp-text"
                    onClick={() => removeCandidate(githubId)}
                  >
                    {selectedCandidateName(githubId)} 삭제
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={!crew || candidateIds.length === 0}
              className="mt-5 w-full rounded-md border border-rp-line bg-rp-purple px-4 py-3 text-sm font-semibold text-white transition hover:shadow-glow-purple disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:shadow-none"
              onClick={runApiCompare}
            >
              DB 기준으로 비교하기
            </button>
            {apiError ? <p className="mt-3 text-xs text-rp-yellow">API 실패 시 로컬 계산 결과를 표시합니다.</p> : null}
          </Surface>
        </section>

        <section className="mt-[54px] grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="크루"
            value={crew ? displayName(crew) : "-"}
            note={crew ? displayMeta(crew) : "크루를 먼저 선택하세요"}
            glow="cyan"
          />
          <MetricCard title="후보" value={formatNumber(candidateIds.length)} note="선택한 리뷰어" glow="purple" />
          <MetricCard title="포함" value={formatNumber(result.matches.length)} note="최근 활동이 있는 같은 트랙 후보" glow="green" />
          <MetricCard title="제외" value={formatNumber(result.excludedCandidates.length)} note="다른 트랙 또는 최근 활동 없음" glow="yellow" />
        </section>

        {result.excludedCandidates.length > 0 ? (
          <Surface glow="yellow" className="mt-8 p-5">
            <h2 className="text-base font-extrabold text-rp-text">제외된 후보</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {result.excludedCandidates.map((candidate) => (
                <span key={candidate.githubId} className="rounded-full border border-rp-line bg-rp-panel2 px-3 py-2 text-xs text-rp-muted">
                  {excludedCandidateName(candidate)} · {excludedReasonLabel(candidate.reason)}
                </span>
              ))}
            </div>
          </Surface>
        ) : null}

        <section className="mt-[58px] grid gap-4">
          {result.matches.map((match, index) => (
            <Surface key={match.reviewer.githubId} glow={index === 0 ? "green" : "purple"} className="p-5">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold text-rp-green">#{index + 1}</p>
                  <h2 className="mt-2 text-xl font-extrabold text-rp-text">{displayName(match.reviewer)}</h2>
                  <p className="mt-1 text-xs text-rp-muted">{displayMeta(match.reviewer)}</p>
                </div>
                <p className="text-[38px] font-extrabold leading-none text-rp-green">{match.score}</p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <p className="text-xs text-rp-subtle">첫 응답 {formatHours(match.reviewer.asReviewer.avgFirstResponseHours)}</p>
                <p className="text-xs text-rp-subtle">재리뷰 중앙값 {formatHours(match.reviewer.asReviewer.avgRereviewHours)}</p>
                <p className="text-xs text-rp-subtle">리뷰 이벤트 {formatNumber(match.reviewer.asReviewer.reviewEvents)}</p>
              </div>
              <MatchScoreBreakdown scores={match.scores} />
            </Surface>
          ))}
        </section>
      </div>
    </main>
  );
}
