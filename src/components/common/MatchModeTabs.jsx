import { Link } from "react-router-dom";
import { cn } from "../../utils/classNames.js";

const baseClass =
  "rounded-md border px-4 py-2 text-xs font-semibold transition";

export default function MatchModeTabs({ active, autoHref = "/matches" }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link
        to={autoHref}
        className={cn(
          baseClass,
          active === "auto"
            ? "border-rp-green bg-rp-green text-rp-bg shadow-glow-green"
            : "border-rp-line bg-rp-panel text-rp-muted hover:text-rp-text",
        )}
      >
        랜덤 매치
      </Link>
      <Link
        to="/matches/compare"
        className={cn(
          baseClass,
          active === "compare"
            ? "border-rp-purple bg-rp-purple text-white shadow-glow-purple"
            : "border-rp-line bg-rp-panel text-rp-muted hover:text-rp-text",
        )}
      >
        후보 직접 비교
      </Link>
    </div>
  );
}
