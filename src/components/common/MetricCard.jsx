import Surface from "./Surface.jsx";
import { cn } from "../../utils/classNames.js";

const valueColors = {
  purple: "text-rp-purple",
  green: "text-rp-green",
  cyan: "text-rp-cyan",
  yellow: "text-rp-yellow",
};

export default function MetricCard({ title, value, note, glow = "purple", onClick }) {
  const interactive = Boolean(onClick);

  return (
    <Surface
      as={interactive ? "button" : "article"}
      type={interactive ? "button" : undefined}
      glow={glow}
      interactive={interactive}
      onClick={onClick}
      className={cn(
        "h-32 overflow-hidden p-[17px] text-left",
        interactive && "w-full appearance-none",
      )}
    >
      <p className="text-xs font-semibold text-rp-muted">{title}</p>
      <p className={cn("mt-2 text-[32px] font-extrabold leading-[38px]", valueColors[glow])}>
        {value}
      </p>
      <p className="mt-5 text-xs leading-4 text-rp-subtle">{note}</p>
    </Surface>
  );
}
