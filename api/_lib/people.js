const TRACK_LABELS = {
  backend: "BE",
  frontend: "FE",
  android: "AN",
};

export function trackLabel(track) {
  return TRACK_LABELS[track] ?? track ?? null;
}

export function formatTrackMeta(person) {
  const parts = [];
  if (person.cohort) parts.push(`${person.cohort}기`);
  if (person.track) parts.push(trackLabel(person.track));
  return parts.join(" ");
}

export function serializePerson(row) {
  const person = {
    githubId: row.github_id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    cohort: row.cohort,
    roles: row.roles ?? [],
    track: row.track,
    asCrew: row.as_crew ?? {},
    asReviewer: row.as_reviewer ?? {},
  };

  person.displayName = person.nickname ?? person.githubId;
  person.displayMeta = [formatTrackMeta(person), `@${person.githubId}`].filter(Boolean).join(" · ");

  return person;
}

export async function loadPeople(client) {
  const result = await client.query(`
    select
      p.github_id,
      p.nickname,
      p.avatar_url,
      p.track,
      p.cohort,
      m.roles,
      p.as_crew,
      p.as_reviewer
    from person_summary_stats p
    left join members m on m.github_id = p.github_id
    order by coalesce(p.cohort, 0) desc, coalesce(p.nickname, p.github_id), p.github_id
  `);
  return result.rows.map(serializePerson);
}
