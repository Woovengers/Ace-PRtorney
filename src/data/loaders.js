import { REVIEWPACE_REPOS } from "../config/repos.js";

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path} 요청 실패: ${response.status}`);
  }
  return response.json();
}

const USE_OVERVIEW_API =
  import.meta.env.PROD || import.meta.env.VITE_USE_DB_API === "true";

async function loadApiJson(path) {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("application/json")) {
    throw new Error(`${path} API 사용 불가`);
  }

  return response.json();
}

function sortPeople(peopleMap) {
  return Object.values(peopleMap).sort((a, b) => {
    const cohortDiff = (b.cohort ?? 0) - (a.cohort ?? 0);
    if (cohortDiff !== 0) return cohortDiff;
    return (a.displayName ?? a.githubId).localeCompare(b.displayName ?? b.githubId, "ko");
  });
}

function fallbackRepositories() {
  return REVIEWPACE_REPOS.map((repo) => {
    const [owner, name] = repo.fullName.split("/");
    return {
      fullName: repo.fullName,
      owner,
      name,
      track: repo.track,
      trackLabel: repo.track === "backend" ? "BE" : repo.track === "frontend" ? "FE" : "AN",
      prCount: 0,
      reviewEventCount: 0,
      reviewerEventCount: 0,
      crewCommentCount: 0,
      crewCount: 0,
      reviewerCount: 0,
      latestActivityAt: null,
    };
  });
}

async function loadOverviewFromApi() {
  const data = await loadApiJson("/api/overview");
  const peopleMap = data.peopleMap ?? data.personStats?.people ?? {};
  const people = data.people ?? sortPeople(peopleMap);

  return {
    members: data.members ?? [],
    people,
    peopleMap,
    repositories: data.repositories ?? [],
    personStats: data.personStats ?? { people: peopleMap },
    summary: data.summary,
    recentActivity: data.recentActivity,
    source: data.source ?? "api",
  };
}

async function loadOverviewFromPublicJson() {
  const [membersJson, personStats, summary, recentActivity] = await Promise.all([
    loadJson("/members.json"),
    loadJson("/person-stats.json"),
    loadJson("/summary.json"),
    loadJson("/recent-activity.json"),
  ]);

  const peopleMap = personStats.people ?? {};
  const members = membersJson.members ?? [];
  const people = sortPeople(peopleMap);

  return {
    members,
    people,
    peopleMap,
    repositories: fallbackRepositories(),
    personStats,
    summary,
    recentActivity,
    source: "public-json",
  };
}

export async function loadOverviewData() {
  if (!USE_OVERVIEW_API) {
    return loadOverviewFromPublicJson();
  }

  try {
    return await loadOverviewFromApi();
  } catch {
    return loadOverviewFromPublicJson();
  }
}
