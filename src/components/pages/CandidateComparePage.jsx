import { useMemo, useState } from "react";
import AppHeader from "../common/AppHeader.jsx";
import MetricCard from "../common/MetricCard.jsx";
import SearchBox from "../common/SearchBox.jsx";
import Surface from "../common/Surface.jsx";
import { fetchJson, shouldUseApi } from "../../data/api.js";
import { compareReviewerCandidates } from "../../utils/reviewerMatch.js";
import { displayMeta, displayName, isPreferredCrew } from "../../utils/person.js";
import { formatHours, formatNumber } from "../../utils/time.js";

function firstCrew(people) {
  return people.find((person) => isPreferredCrew(person)) ?? people.find((person) => person.asCrew?.hasData);
}

function candidateLabel(person) {
  return `${displayName(person)} · @${person.githubId}`;
}

export default function CandidateComparePage({ people, selectedPerson, onSelectPerson }) {
  const crewPeople = people.filter((person) => person.asCrew?.hasData);
  const reviewerPeople = people.filter((person) => person.asReviewer?.hasData);
  const [crew, setCrew] = useState(selectedPerson?.asCrew?.hasData ? selectedPerson : firstCrew(crewPeople));
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidateIds, setCandidateIds] = useState([]);
  const [apiResult, setApiResult] = useState(null);
  const [apiError, setApiError] = useState(null);

  const candidateMatches = useMemo(
    () => compareReviewerCandidates(crew, people, candidateIds),
    [crew, people, candidateIds],
  );
  const result = apiResult ?? { crew, ...candidateMatches };
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

  async function runApiCompare() {
    setApiError(null);
    setApiResult(null);
    if (!shouldUseApi()) return;

    try {
      const data = await fetchJson("/api/matches/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewGithubId: crew.githubId,
          candidateReviewerGithubIds: candidateIds,
        }),
      });

  if (!crew) {
    return (
      <main className="page-grid grid min-h-screen place-items-center px-6 text-rp-text">
        <Surface glow="yellow" className="max-w-lg p-6">
          <p className="text-xs font-semibold text-rp-yellow">NO CREW DATA</p>
          <h1 className="mt-3 text-2xl font-extrabold">비교할 크루 데이터가 없습니다.</h1>
        </Surface>
      </main>
    );
  }
      setApiResult(data);
    } catch (error) {
      setApiError(error);
    }
  }

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <AppHeader active="match" />

      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-12 md:px-[54px]">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold text-rp-purple">CANDIDATE COMPARE</p>
          <h1 className="mt-3 text-[46px] font-extrabold leading-none md:text-[72px]">
            Candidate Compare
          </h1>
          <p className="mt-6 text-base text-rp-muted">
            특정 크루에게 후보 리뷰어를 직접 넣고, 같은 기준으로 점수를 비교합니다.
          </p>
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
                placeholder="후보 리뷰어 GitHub ID 또는 닉네임 검색"
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
                      <span className="text-sm font-semibold text-rp-text">{candidateLabel(person)}</span>
                      <span className="text-xs text-rp-subtle">{person.track}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </Surface>
          </div>

          <Surface glow="purple" className="p-5">
            <h2 className="text-base font-extrabold text-rp-text">Selected Candidates</h2>
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
                    @{githubId} remove
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              className="mt-5 w-full rounded-md border border-rp-line bg-rp-purple px-4 py-3 text-sm font-semibold text-white transition hover:shadow-glow-purple"
              onClick={runApiCompare}
            >
              Compare with API
            </button>
            {apiError ? <p className="mt-3 text-xs text-rp-yellow">API 실패 시 로컬 계산 결과를 표시합니다.</p> : null}
          </Surface>
        </section>

        <section className="mt-[54px] grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Crew" value={displayName(crew)} note={displayMeta(crew)} glow="cyan" />
          <MetricCard title="Candidates" value={formatNumber(candidateIds.length)} note="selected reviewers" glow="purple" />
          <MetricCard title="Included" value={formatNumber(result.matches.length)} note="same track candidates" glow="green" />
          <MetricCard title="Excluded" value={formatNumber(result.excludedCandidates.length)} note="different track / no data" glow="yellow" />
        </section>

        {result.excludedCandidates.length > 0 ? (
          <Surface glow="yellow" className="mt-8 p-5">
            <h2 className="text-base font-extrabold text-rp-text">Excluded Candidates</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {result.excludedCandidates.map((candidate) => (
                <span key={candidate.githubId} className="rounded-full border border-rp-line bg-rp-panel2 px-3 py-2 text-xs text-rp-muted">
                  @{candidate.githubId} · {candidate.reason}
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
                <p className="text-xs text-rp-subtle">first {formatHours(match.reviewer.asReviewer.avgFirstResponseHours)}</p>
                <p className="text-xs text-rp-subtle">rereview {formatHours(match.reviewer.asReviewer.avgRereviewHours)}</p>
                <p className="text-xs text-rp-subtle">events {formatNumber(match.reviewer.asReviewer.reviewEvents)}</p>
              </div>
            </Surface>
          ))}
        </section>
      </div>
    </main>
  );
}
