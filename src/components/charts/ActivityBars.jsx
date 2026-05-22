import Surface from "../common/Surface.jsx";
import { cn } from "../../utils/classNames.js";

const glowText = {
  purple: "text-rp-purple",
  green: "text-rp-green",
  cyan: "text-rp-cyan",
  yellow: "text-rp-yellow",
};

export default function ActivityBars({ title, values = [], labels, glow = "purple" }) {
  const max = Math.max(...values, 1);

  return (
    <Surface glow={glow} className="p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-extrabold text-rp-text">{title}</h2>
        <p className={cn("text-xs font-semibold", glowText[glow])}>
          {values.reduce((total, value) => total + value, 0)} events
        </p>
      </div>
      <div className="mt-5 grid h-36 grid-cols-[repeat(var(--bar-count),minmax(0,1fr))] items-end gap-1" style={{ "--bar-count": values.length }}>
        {values.map((value, index) => (
          <div key={`${labels?.[index] ?? index}-${index}`} className="flex min-w-0 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end rounded-sm bg-rp-panel2">
              <div
                className={cn(
                  "w-full rounded-sm transition",
                  glow === "green" && "bg-rp-green",
                  glow === "purple" && "bg-rp-purple",
                  glow === "cyan" && "bg-rp-cyan",
                  glow === "yellow" && "bg-rp-yellow",
                )}
                style={{ height: `${Math.max((value / max) * 100, value > 0 ? 8 : 0)}%` }}
                title={`${labels?.[index] ?? index}: ${value}`}
              />
            </div>
            <span className="truncate text-[10px] text-rp-subtle">{labels?.[index] ?? index}</span>
          </div>
        ))}
      </div>
    </Surface>
  );
}
