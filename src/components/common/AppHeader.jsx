import { Link } from "react-router-dom";
import { cn } from "../../utils/classNames.js";

const baseLinkClass = "transition hover:text-rp-text";
const activeLinkClass = "font-semibold text-rp-text";

export default function AppHeader({ active }) {
  function navClass(key) {
    return cn(baseLinkClass, active === key && activeLinkClass);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-rp-line/70 bg-rp-bg/92 backdrop-blur">
      <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center px-6 md:px-12">
        <Link to="/trial" className="text-lg font-extrabold">
          PRtorney
        </Link>
        <Link to="/trial" className={cn("ml-auto text-sm font-semibold transition md:hidden", active === "trial" ? "text-rp-text" : "text-rp-subtle")}>
          Trial
        </Link>
        <nav className="ml-auto hidden items-center gap-5 text-[13px] text-rp-subtle md:flex">
          <Link to="/" className={navClass("overview")}>Overview</Link>
          <Link to="/crew" className={navClass("crew")}>Crew</Link>
          <Link to="/reviewer" className={navClass("reviewer")}>Reviewers</Link>
          <Link to="/missions" className={navClass("missions")}>Missions</Link>
          <Link to="/matches" className={navClass("match")}>Match</Link>
          <Link to="/trial" className={navClass("trial")}>Trial</Link>
        </nav>
      </div>
    </header>
  );
}
