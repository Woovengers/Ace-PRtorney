const SCORE_FIELDS = [
  { key: "overlap", label: "활동 시간대 궁합", weight: 40, glow: "cyan" },
  { key: "firstReviewSpeed", label: "첫 리뷰 응답", weight: 25, glow: "green" },
  { key: "rereviewSpeed", label: "크루 응답 후 재리뷰", weight: 20, glow: "purple" },
  { key: "trackFit", label: "같은 트랙", weight: 10, glow: "yellow" },
  { key: "recentActivity", label: "최근 리뷰 활동", weight: 5, glow: "green" },
];

function scoreColor(glow) {
  if (glow === "green") return "bg-rp-green";
  if (glow === "cyan") return "bg-rp-cyan";
  if (glow === "yellow") return "bg-rp-yellow";
  return "bg-rp-purple";
}

function normalizeScore(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

export default function MatchScoreBreakdown({ scores }) {
  return (
    <div className="mt-6 border-t border-rp-line pt-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-sm font-extrabold text-rp-text">왜 이 리뷰어인가요?</h3>
        <p className="text-[11px] text-rp-subtle">항목 점수 / 최종 반영 비율</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {SCORE_FIELDS.map((field) => {
          const value = normalizeScore(scores?.[field.key]);
          return (
            <div key={field.key}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-rp-subtle">{field.label}</span>
                <span className="font-semibold text-rp-text">{value}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-rp-panel2">
                <div className={`h-full rounded-full ${scoreColor(field.glow)}`} style={{ width: `${value}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-rp-subtle">{field.weight}% 반영</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
