import Surface from "../common/Surface.jsx";
import { formatNumber } from "../../utils/time.js";

export default function TrackDistribution({ rows }) {
  return (
    <Surface glow="purple" className="p-5">
      <h2 className="text-lg font-extrabold text-rp-text">Track Distribution</h2>
      <div className="mt-5 divide-y divide-rp-line/70">
        {rows.map((row) => (
          <div key={row.track} className="grid grid-cols-[1fr_auto] gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-rp-text">
                {row.track === "backend" ? "Backend" : row.track === "frontend" ? "Frontend" : "Android"}
              </p>
              <p className="mt-1 text-xs text-rp-muted">{formatNumber(row.prs)} PRs</p>
            </div>
            <p className="text-right text-[13px] font-semibold text-rp-text">{row.percent}%</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}
