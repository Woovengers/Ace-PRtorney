import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { loadOverviewData } from "./data/loaders.js";
import OverviewPage from "./components/pages/OverviewPage.jsx";
import PersonDetailPage from "./components/pages/PersonDetailPage.jsx";
import PlaceholderPage from "./components/pages/PlaceholderPage.jsx";

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
    <Routes>
      <Route
        path="/"
        element={
          <OverviewPage
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
        path="/crew"
        element={
          <PersonDetailPage
            data={data}
            loading={!data}
            mode="crew"
            people={people}
            selectedPerson={selectedPerson}
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
            selectedPerson={selectedPerson}
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
            selectedPerson={selectedPerson}
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
            selectedPerson={selectedPerson}
            onNavigate={handleNavigate}
            onSelectPerson={setSelectedPerson}
          />
        }
      />
      <Route path="/missions" element={<PlaceholderPage type="missions" />} />
      <Route path="/compare" element={<PlaceholderPage type="compare" />} />
      <Route path="/matches" element={<PlaceholderPage type="matches" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
