import Surface from "../common/Surface.jsx";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function cellColor(value, max, glow) {
  if (!value) return "rgba(42,42,42,0.55)";
  const alpha = 0.18 + (value / max) * 0.72;
  if (glow === "green") return `rgba(183,255,90,${alpha})`;
  if (glow === "cyan") return `rgba(110,231,249,${alpha})`;
  if (glow === "yellow") return `rgba(253,224,71,${alpha})`;
  return `rgba(168,85,247,${alpha})`;
}

export default function HeatmapGrid({ title, values = [], glow = "purple" }) {
  const max = Math.max(...values.flat(), 1);

  return (
    <Surface glow={glow} className="overflow-hidden p-5">
      <h2 className="text-base font-extrabold text-rp-text">{title}</h2>
      <div className="mt-5 overflow-x-auto pb-1">
        <div className="grid min-w-[620px] grid-cols-[42px_repeat(24,minmax(0,1fr))] gap-1">
          <div />
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="text-center text-[9px] text-rp-subtle">
              {hour % 3 === 0 ? hour : ""}
            </div>
          ))}
          {values.map((row, weekday) => (
            <div key={WEEKDAYS[weekday]} className="contents">
              <div className="pr-2 text-right text-[10px] text-rp-subtle">{WEEKDAYS[weekday]}</div>
              {row.map((value, hour) => (
                <div
                  key={`${weekday}-${hour}`}
                  className="h-4 rounded-sm"
                  style={{ backgroundColor: cellColor(value, max, glow) }}
                  title={`${WEEKDAYS[weekday]} ${hour}:00 · ${value}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Surface>
  );
}
