import { Link } from "react-router-dom";
import { cn } from "../../utils/classNames.js";

const baseLinkClass = "transition hover:text-rp-text";
const activeLinkClass = "font-semibold text-rp-text";

export default function AppHeader({ active, personGithubId }) {
  const crewPath = personGithubId ? `/crew/${personGithubId}` : "/crew";
  const reviewerPath = personGithubId ? `/reviewer/${personGithubId}` : "/reviewer";

  function navClass(key) {
    return cn(baseLinkClass, active === key && activeLinkClass);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-rp-line/70 bg-rp-bg/92 backdrop-blur">
      <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center px-6 md:px-12">
        <Link to="/" className="text-lg font-extrabold">
          Review Pace
        </Link>
        <nav className="ml-auto hidden items-center gap-5 text-[13px] text-rp-subtle md:flex">
          <Link to="/" className={navClass("overview")}>Overview</Link>
          <Link to={crewPath} className={navClass("crew")}>Crew</Link>
          <Link to={reviewerPath} className={navClass("reviewer")}>Reviewers</Link>
          <Link to="/missions" className={navClass("missions")}>Missions</Link>
          <Link to="/matches" className={navClass("match")}>Match</Link>
          <span className="text-rp-subtle">PRs</span>
        </nav>
      </div>
    </header>
  );
}
