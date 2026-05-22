import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import MetricCard from "../common/MetricCard.jsx";
import Surface from "../common/Surface.jsx";
import { fetchJson, shouldUseApi } from "../../data/api.js";
import { formatHours, formatNumber, formatShortDate } from "../../utils/time.js";

function missionPath(repo) {
  return `/missions/${repo.owner}/${repo.name}`;
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

export default function MissionDetailPage({ data, loading }) {
  const { owner, name } = useParams();
  const repositories = data?.repositories ?? [];
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);

    if (!owner || !name || !shouldUseApi()) {
      return () => {
        cancelled = true;
      };
    }

    fetchJson(`/api/repos/${owner}/${name}`)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, name]);

  if (loading) return <LoadingState />;

  if (!owner || !name) {
    const firstRepo = repositories.find((repo) => repo.prCount > 0) ?? repositories[0];
    return firstRepo ? <Navigate to={missionPath(firstRepo)} replace /> : <Navigate to="/missions" replace />;
  }

  const repo = repositories.find((candidate) => candidate.owner === owner && candidate.name === name);

  if (!repo) {
    return (
      <main className="page-grid grid min-h-screen place-items-center px-6 text-rp-text">
        <Surface glow="yellow" className="max-w-lg p-6">
          <p className="text-xs font-semibold text-rp-yellow">MISSION NOT FOUND</p>
          <h1 className="mt-3 text-2xl font-extrabold">{owner}/{name} 데이터를 찾지 못했습니다.</h1>
          <Link className="mt-5 inline-flex text-sm font-semibold text-rp-cyan" to="/missions">
            Mission Board로 돌아가기
          </Link>
        </Surface>
      </main>
    );
  }

  const reviewDensity = repo.prCount > 0 ? Math.round((repo.reviewEventCount / repo.prCount) * 10) / 10 : null;
  const reviewerDensity = repo.prCount > 0 ? Math.round((repo.reviewerCount / repo.prCount) * 10) / 10 : null;

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <header className="sticky top-0 z-30 border-b border-rp-line/70 bg-rp-bg/92 backdrop-blur">
        <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center px-6 md:px-12">
          <Link to="/" className="text-lg font-extrabold">
            Review Pace
          </Link>
          <nav className="ml-auto hidden items-center gap-5 text-[13px] text-rp-subtle md:flex">
            <Link to="/" className="hover:text-rp-text">Overview</Link>
            <Link to="/crew" className="hover:text-rp-text">Crew</Link>
            <Link to="/reviewer" className="hover:text-rp-text">Reviewers</Link>
            <Link to="/missions" className="font-semibold text-rp-text">Missions</Link>
            <Link to="/matches" className="hover:text-rp-text">Match</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-10 md:px-[54px]">
        <section className="max-w-4xl">
          <Link to="/missions" className="text-xs font-semibold text-rp-subtle transition hover:text-rp-text">
            Mission Board
          </Link>
          <p className="mt-5 text-xs font-semibold text-rp-cyan">{repo.trackLabel} MISSION</p>
          <h1 className="mt-3 break-words text-[42px] font-extrabold leading-none md:text-[68px]">
            {repo.name}
          </h1>
          <p className="mt-6 text-base text-rp-muted">{repo.fullName}</p>
        </section>

        <section className="mt-[54px] grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Closed PRs" value={formatNumber(repo.prCount)} note="closed / merged PR" glow="purple" />
          <MetricCard title="Review Events" value={formatNumber(repo.reviewEventCount)} note="review submissions" glow="green" />
          <MetricCard title="Crew" value={formatNumber(repo.crewCount)} note="unique PR authors" glow="cyan" />
          <MetricCard title="Reviewers" value={formatNumber(repo.reviewerCount)} note="unique reviewers" glow="yellow" />
        </section>

        <section className="mt-[58px] grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Surface glow="purple" className="p-5">
            <h2 className="text-base font-extrabold text-rp-text">Review Flow</h2>
            <div className="mt-6 grid gap-4 divide-y divide-rp-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="py-3 sm:px-4 sm:py-0 sm:first:pl-0">
                <p className="text-2xl font-extrabold text-rp-green">{formatNumber(repo.reviewerEventCount)}</p>
                <p className="mt-2 text-xs text-rp-subtle">reviewer events</p>
              </div>
              <div className="py-3 sm:px-4 sm:py-0">
                <p className="text-2xl font-extrabold text-rp-cyan">{formatNumber(repo.crewCommentCount)}</p>
                <p className="mt-2 text-xs text-rp-subtle">crew comments</p>
              </div>
              <div className="py-3 sm:px-4 sm:py-0">
                <p className="text-2xl font-extrabold text-rp-yellow">
                  {reviewDensity === null ? "-" : reviewDensity}
                </p>
                <p className="mt-2 text-xs text-rp-subtle">reviews per PR</p>
              </div>
            </div>
          </Surface>

          <Surface glow="cyan" className="p-5">
            <h2 className="text-base font-extrabold text-rp-text">Data Freshness</h2>
            <p className="mt-6 text-[38px] font-extrabold leading-none text-rp-cyan">
              {formatShortDate(repo.latestActivityAt)}
            </p>
            <p className="mt-4 text-sm leading-6 text-rp-muted">
              reviewer density {reviewerDensity === null ? "-" : reviewerDensity} · track {repo.trackLabel}
            </p>
          </Surface>
        </section>

        {detail?.recentPrs?.length ? (
          <section className="mt-[58px] grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Surface glow="green" className="p-5">
              <h2 className="text-base font-extrabold text-rp-text">Recent PRs</h2>
              <div className="mt-5 divide-y divide-rp-line">
                {detail.recentPrs.map((pr) => (
                  <Link
                    key={`${pr.repoFullName}#${pr.prNumber}`}
                    to={pr.path}
                    className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[1fr_260px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-rp-text">
                        #{pr.prNumber} {pr.title}
                      </p>
                      <p className="mt-1 text-xs text-rp-subtle">
                        {pr.author} · {formatShortDate(pr.createdAt)}
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
            </Surface>

            <Surface glow="purple" className="p-5">
              <h2 className="text-base font-extrabold text-rp-text">Top People</h2>
              <div className="mt-5 grid gap-6">
                <div>
                  <p className="text-xs font-semibold text-rp-green">Reviewers</p>
                  <div className="mt-3 space-y-2">
                    {(detail.topReviewers ?? []).map((person) => (
                      <p key={person.github_id} className="flex justify-between gap-4 text-sm">
                        <span className="truncate text-rp-muted">@{person.github_id}</span>
                        <span className="font-semibold text-rp-text">{formatNumber(person.events)}</span>
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-rp-cyan">Crew</p>
                  <div className="mt-3 space-y-2">
                    {(detail.topCrew ?? []).map((person) => (
                      <p key={person.github_id} className="flex justify-between gap-4 text-sm">
                        <span className="truncate text-rp-muted">@{person.github_id}</span>
                        <span className="font-semibold text-rp-text">{formatNumber(person.prs)}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </Surface>
          </section>
        ) : null}
      </div>
    </main>
  );
}
