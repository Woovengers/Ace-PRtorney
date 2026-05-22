import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { loadOverviewData } from "./data/loaders.js";
import CandidateComparePage from "./components/pages/CandidateComparePage.jsx";
import MissionBoardPage from "./components/pages/MissionBoardPage.jsx";
import MissionDetailPage from "./components/pages/MissionDetailPage.jsx";
import OverviewPage from "./components/pages/OverviewPage.jsx";
import PersonDetailPage from "./components/pages/PersonDetailPage.jsx";
import PrDrilldownPage from "./components/pages/PrDrilldownPage.jsx";
import ReviewerMatchPage from "./components/pages/ReviewerMatchPage.jsx";
import TrackComparePage from "./components/pages/TrackComparePage.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    loadOverviewData()
      .then((overviewData) => {
        if (!cancelled) setData(overviewData);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const people = useMemo(() => data?.people ?? [], [data]);

  function handleNavigate(route, payload) {
    if (payload?.githubId) {
      setSelectedPerson(payload);
      navigate(`/${route}/${payload.githubId}`);
    } else {
      navigate(`/${route}`);
    }
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-rp-bg px-6 text-rp-text">
        <section className="max-w-lg rounded-lg border border-rp-line bg-rp-panel p-6 shadow-glow-purple">
          <p className="text-sm font-semibold text-rp-purple">DATA LOAD FAILED</p>
          <h1 className="mt-3 text-2xl font-extrabold">Overview 데이터를 불러오지 못했습니다.</h1>
          <p className="mt-3 text-sm text-rp-muted">{error.message}</p>
        </section>
      </main>
    );
  }

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route
          path="/"
          element={
            <OverviewPage
              data={data}
              loading={!data}
              people={people}
              onNavigate={handleNavigate}
              onSelectPerson={setSelectedPerson}
            />
          }
        />
        <Route
          path="/crew"
          element={
            <PersonDetailPage
              data={data}
              loading={!data}
              mode="crew"
              people={people}
              onNavigate={handleNavigate}
              onSelectPerson={setSelectedPerson}
            />
          }
        />
        <Route
          path="/crew/:githubId"
          element={
            <PersonDetailPage
              data={data}
              loading={!data}
              mode="crew"
              people={people}
              onNavigate={handleNavigate}
              onSelectPerson={setSelectedPerson}
            />
          }
        />
        <Route
          path="/reviewer"
          element={
            <PersonDetailPage
              data={data}
              loading={!data}
              mode="reviewer"
              people={people}
              onNavigate={handleNavigate}
              onSelectPerson={setSelectedPerson}
            />
          }
        />
        <Route
          path="/reviewer/:githubId"
          element={
            <PersonDetailPage
              data={data}
              loading={!data}
              mode="reviewer"
              people={people}
              onNavigate={handleNavigate}
              onSelectPerson={setSelectedPerson}
            />
          }
        />
        <Route path="/missions" element={<MissionBoardPage data={data} loading={!data} />} />
        <Route path="/missions/:owner/:name" element={<MissionDetailPage data={data} loading={!data} />} />
        <Route path="/compare" element={<TrackComparePage data={data} loading={!data} />} />
        <Route
          path="/matches/compare"
          element={
            <CandidateComparePage
              people={people}
              onSelectPerson={setSelectedPerson}
            />
          }
        />
        <Route
          path="/matches"
          element={
            <ReviewerMatchPage
              data={data}
              loading={!data}
              people={people}
              selectedPerson={selectedPerson}
              onNavigate={handleNavigate}
              onSelectPerson={setSelectedPerson}
            />
          }
        />
        <Route
          path="/matches/:githubId"
          element={
            <ReviewerMatchPage
              data={data}
              loading={!data}
              people={people}
              selectedPerson={selectedPerson}
              onNavigate={handleNavigate}
              onSelectPerson={setSelectedPerson}
            />
          }
        />
        <Route path="/prs/:owner/:repo/:number" element={<PrDrilldownPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
