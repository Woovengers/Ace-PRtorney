import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppHeader from "../common/AppHeader.jsx";
import MetricCard from "../common/MetricCard.jsx";
import Surface from "../common/Surface.jsx";
import { fetchJson, shouldUseApi } from "../../data/api.js";
import { cn } from "../../utils/classNames.js";
import { formatHours, formatNumber, formatShortDate } from "../../utils/time.js";

const eventColors = {
  PR_OPENED: "text-rp-cyan",
  FIRST_REVIEW: "text-rp-green",
  CHANGES_REQUESTED: "text-rp-purple",
  CREW_RESPONSE: "text-rp-cyan",
  REREVIEW: "text-rp-green",
  APPROVED: "text-rp-yellow",
  CLOSED_OR_MERGED: "text-rp-yellow",
};

function eventTitle(event) {
  return event.type.replaceAll("_", " ").toLowerCase();
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

function Timeline({ events }) {
  return (
    <Surface glow="purple" className="p-5">
      <h2 className="text-base font-extrabold text-rp-text">PR Timeline</h2>
      <div className="mt-6 space-y-4">
        {events.map((event, index) => (
          <a
            key={`${event.type}-${event.occurredAt}-${index}`}
            href={event.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="grid cursor-pointer grid-cols-[96px_1fr] gap-4 rounded-lg border border-rp-line bg-rp-panel2 p-4 transition hover:bg-rp-panel"
          >
            <div className="text-xs text-rp-subtle">{formatShortDate(event.occurredAt)}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("text-xs font-semibold uppercase", eventColors[event.type])}>
                  {eventTitle(event)}
                </span>
                <span className="rounded-full border border-rp-line px-2 py-0.5 text-[10px] text-rp-muted">
                  {event.role}
                </span>
                {event.state ? (
                  <span className="text-[10px] text-rp-subtle">{event.state}</span>
                ) : null}
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-rp-text">{event.actor}</p>
            </div>
          </a>
        ))}
      </div>
    </Surface>
  );
}

export default function PrDrilldownPage() {
  const { owner, repo, number } = useParams();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPayload(null);
    setError(null);

    if (!shouldUseApi()) {
      setError(new Error("PR Drilldown은 DB API가 필요한 화면입니다. npx vercel dev 또는 배포 환경에서 확인하세요."));
      return () => {
        cancelled = true;
      };
    }

    fetchJson(`/api/prs/${owner}/${repo}/${number}`)
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, repo, number]);

  if (!payload && !error) return <LoadingState />;

  return (
    <main className="page-grid min-h-screen overflow-x-hidden text-rp-text">
      <AppHeader active="prs" />

      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-10 md:px-[54px]">
        {error ? (
          <Surface glow="yellow" className="max-w-2xl p-6">
            <p className="text-xs font-semibold text-rp-yellow">PR LOAD FAILED</p>
            <h1 className="mt-3 text-2xl font-extrabold">PR 데이터를 불러오지 못했습니다.</h1>
            <p className="mt-3 text-sm text-rp-muted">{error.message}</p>
          </Surface>
        ) : (
          <>
            <section className="max-w-4xl">
              <Link
                to={`/missions/${owner}/${repo}`}
                className="text-xs font-semibold text-rp-subtle transition hover:text-rp-text"
              >
                {payload.pr.repoFullName}
              </Link>
              <p className="mt-5 text-xs font-semibold text-rp-purple">PR DRILLDOWN</p>
              <h1 className="mt-3 break-words text-[36px] font-extrabold leading-tight md:text-[56px]">
                #{payload.pr.prNumber} {payload.pr.title}
              </h1>
              <p className="mt-5 text-base text-rp-muted">
                opened by {payload.pr.author} · {formatShortDate(payload.pr.createdAt)}
              </p>
              {payload.pr.url ? (
                <a
                  className="mt-5 inline-flex text-sm font-semibold text-rp-cyan"
                  href={payload.pr.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub에서 보기
                </a>
              ) : null}
            </section>

            <section className="mt-[54px] grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="First Review" value={formatHours(payload.metrics.firstReviewHours)} note="PR opened to first review" glow="green" />
              <MetricCard title="Completion" value={formatHours(payload.metrics.completionHours)} note="opened to merged / closed" glow="yellow" />
              <MetricCard title="Rounds" value={formatNumber(payload.metrics.rounds)} note="changes requested" glow="purple" />
              <MetricCard title="Review Events" value={formatNumber(payload.metrics.reviewEvents)} note="crew + reviewer events" glow="cyan" />
            </section>

            <section className="mt-[58px]">
              <Timeline events={payload.events} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
