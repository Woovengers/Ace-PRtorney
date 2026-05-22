import { Link } from "react-router-dom";
import AppHeader from "../common/AppHeader.jsx";
import Surface from "../common/Surface.jsx";

const titles = {
  matches: "Reviewer Match",
};

export default function PlaceholderPage({ type = "missions" }) {
  return (
    <main className="page-grid min-h-screen text-rp-text">
      <AppHeader />
      <div className="mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-[1440px] place-items-center px-6 py-16 md:px-[54px]">
        <Surface glow="yellow" className="max-w-lg p-6">
          <p className="text-xs font-semibold text-rp-yellow">NEXT STEP</p>
          <h1 className="mt-3 text-3xl font-extrabold">{titles[type] ?? "Detail Page"}</h1>
          <p className="mt-4 text-sm leading-6 text-rp-muted">
            후보 여러 명을 직접 넣어 비교하는 화면은 다음 구현 범위입니다. 현재 단계에서는 크루별 Reviewer Match 추천을 먼저 연결했습니다.
          </p>
          <Link className="mt-6 inline-flex text-sm font-semibold text-rp-cyan" to="/">
            Overview로 돌아가기
          </Link>
        </Surface>
      </div>
    </main>
  );
}
