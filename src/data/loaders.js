async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path} 요청 실패: ${response.status}`);
  }
  return response.json();
}

export async function loadOverviewData() {
  const [membersJson, personStats, summary, recentActivity] = await Promise.all([
    loadJson("/members.json"),
    loadJson("/person-stats.json"),
    loadJson("/summary.json"),
    loadJson("/recent-activity.json"),
  ]);

  const peopleMap = personStats.people ?? {};
  const members = membersJson.members ?? [];
  const people = Object.values(peopleMap).sort((a, b) => {
    const cohortDiff = (b.cohort ?? 0) - (a.cohort ?? 0);
    if (cohortDiff !== 0) return cohortDiff;
    return (a.displayName ?? a.githubId).localeCompare(b.displayName ?? b.githubId, "ko");
  });

  return {
    members,
    people,
    peopleMap,
    personStats,
    summary,
    recentActivity,
  };
}
