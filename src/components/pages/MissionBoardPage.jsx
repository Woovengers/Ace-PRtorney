import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../common/AppHeader.jsx";
import MetricCard from "../common/MetricCard.jsx";
import Surface from "../common/Surface.jsx";
import { cn } from "../../utils/classNames.js";
import { formatNumber, formatShortDate } from "../../utils/time.js";

const TRACK_FILTERS = [
  { label: "All", value: "all" },
  { label: "Backend", value: "backend" },
  { label: "Frontend", value: "frontend" },
  { label: "Android", value: "android" },
];

function missionPath(repo) {
  return `/missions/${repo.owner}/${repo.name}`;
}

function SkeletonRow() {
  return (
    <Surface className="h-28 animate-pulse p-5">
      <div className="h-3 w-32 rounded bg-rp-line" />
      <div className="mt-4 h-6 w-56 rounded bg-rp-line" />
      <div className="mt-5 h-3 w-full max-w-lg rounded bg-rp-line" />
    </Surface>
  );
}

function RepoRow({ repo }) {
  return (
    <Link to={missionPath(repo)} className="block">
      <Surface interactive glow="purple" className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-rp-line bg-rp-panel2 px-2 py-1 text-[10px] font-semibold text-rp-cyan">
                {repo.trackLabel}
              </span>
              <span className="text-xs text-rp-subtle">{repo.owner}</span>
            </div>
            <h2 className="mt-3 truncate text-xl font-extrabold text-rp-text">{repo.name}</h2>
            <p className="mt-2 truncate text-xs text-rp-muted">{repo.fullName}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-right sm:min-w-[360px]">
            <div>
              <p className="text-lg font-extrabold text-rp-purple">{formatNumber(repo.prCount)}</p>
              <p className="text-[10px] text-rp-subtle">PRs</p>
            </div>
            <div>
              <p className="text-lg font-extrabold text-rp-green">{formatNumber(repo.reviewEventCount)}</p>
              <p className="text-[10px] text-rp-subtle">reviews</p>
            </div>
            <div>
              <p className="text-lg font-extrabold text-rp-yellow">{formatShortDate(repo.latestActivityAt)}</p>
              <p className="text-[10px] text-rp-subtle">latest</p>
            </div>
          </div>
        </div>
      </Surface>
    </Link>
  );
}

export default function MissionBoardPage({ data, loading }) {
  const [trackFilter, setTrackFilter] = useState("all");
  const [query, setQuery] = useState("");
  const repositories = data?.repositories ?? [];

  const filteredRepos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return repositories.filter((repo) => {
      const matchesTrack = trackFilter === "all" || repo.track === trackFilter;
      const matchesQuery =
        !normalized ||
        [repo.fullName, repo.owner, repo.name, repo.track].join(" ").toLowerCase().includes(normalized);
      return matchesTrack && matchesQuery;
    });
  }, [repositories, query, trackFilter]);

  const totals = useMemo(
    () =>
      filteredRepos.reduce(
        (acc, repo) => ({
          prs: acc.prs + repo.prCount,
          reviews: acc.reviews + repo.reviewEventCount,
          reviewers: acc.reviewers + repo.reviewerCount,
          crew: acc.crew + repo.crewCount,
        }),
        { prs: 0, reviews: 0, reviewers: 0, crew: 0 },
      ),
    [filteredRepos],
  );

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <AppHeader active="missions" />

      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-12 md:px-[54px]">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold text-rp-purple">MISSION BOARD</p>
          <h1 className="mt-3 text-[46px] font-extrabold leading-none md:text-[72px]">
            Mission Board
          </h1>
          <p className="mt-6 text-base text-rp-muted">
            미션 repo별 PR 규모, 리뷰 이벤트, 참여 인원을 비교합니다.
          </p>
        </section>

        <section className="mt-8 max-w-4xl">
          <Surface glow="cyan" className="p-2">
            <label className="sr-only" htmlFor="mission-search">미션 검색</label>
            <input
              id="mission-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="repo 이름 또는 트랙 검색"
              className="min-h-12 w-full rounded-md border border-rp-line bg-rp-bg px-4 text-sm text-rp-text outline-none transition focus:border-rp-cyan"
            />
          </Surface>
          <div className="mt-4 flex flex-wrap gap-2">
            {TRACK_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-semibold transition",
                  trackFilter === filter.value
                    ? "border-rp-cyan bg-rp-cyan text-black shadow-glow-cyan"
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
          <MetricCard title="Missions" value={formatNumber(filteredRepos.length)} note="filtered repositories" glow="cyan" />
          <MetricCard title="Closed PRs" value={formatNumber(totals.prs)} note="selected mission PRs" glow="purple" />
          <MetricCard title="Review Events" value={formatNumber(totals.reviews)} note="review submissions" glow="green" />
          <MetricCard title="People" value={formatNumber(totals.crew + totals.reviewers)} note="crew + reviewer appearances" glow="yellow" />
        </section>

        <section className="mt-[58px] grid gap-4">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : (
            filteredRepos.map((repo) => <RepoRow key={repo.fullName} repo={repo} />)
          )}
        </section>
      </div>
    </main>
  );
}
