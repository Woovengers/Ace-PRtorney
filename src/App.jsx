import { useEffect, useMemo, useState } from "react";
import { loadOverviewData } from "./data/loaders.js";
import OverviewPage from "./components/pages/OverviewPage.jsx";

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);

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
      window.history.replaceState(null, "", `#${route}/${payload.githubId}`);
    } else {
      window.history.replaceState(null, "", `#${route}`);
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
    <OverviewPage
      data={data}
      loading={!data}
      people={people}
      selectedPerson={selectedPerson}
      onNavigate={handleNavigate}
      onSelectPerson={setSelectedPerson}
    />
  );
}
