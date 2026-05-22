const TRACK_LABELS = {
  backend: "BE",
  frontend: "FE",
  android: "AN",
};

export const RECENT_REVIEW_WINDOW_DAYS = 30;

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function clampFutureIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const now = new Date();
  return (date > now ? now : date).toISOString();
}

export function cutoffIso(referenceAt, days = RECENT_REVIEW_WINDOW_DAYS) {
  if (!referenceAt) return null;
  const date = new Date(referenceAt);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

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

export async function loadRecentReferenceAt(client) {
  const result = await client.query(`
    select
      (
        select max(finished_at)
        from sync_runs
        where status = 'success'
      ) as sync_reference_at,
      (
        select max(submitted_at)
        from review_events
        where author_role = 'reviewer'
      ) as latest_reviewer_event_at
  `);
  const row = result.rows[0] ?? {};
  return clampFutureIso(row.sync_reference_at ?? row.latest_reviewer_event_at);
}

export async function enrichPeopleActivity(client, people, recentReferenceAt) {
  const peopleMap = new Map(people.map((person) => [person.githubId, person]));
  const cutoff = cutoffIso(recentReferenceAt);

  const reviewerResult = await client.query(
    `
        select
          reviewer_login as github_id,
          max(submitted_at) as latest_review_at,
          count(*) filter (
            where $1::timestamptz is not null
              and submitted_at >= $1::timestamptz
          )::int as recent_30d_review_count
        from review_events
        where author_role = 'reviewer'
          and reviewer_login is not null
          and reviewer_login <> 'unknown'
        group by reviewer_login
      `,
    [cutoff],
  );
  const crewResult = await client.query(`
      select
        author_login as github_id,
        max(created_at) as latest_crew_activity_at
      from pull_requests
      where author_login is not null
        and author_login <> 'unknown'
      group by author_login
    `);

  for (const row of reviewerResult.rows) {
    const person = peopleMap.get(row.github_id);
    if (!person) continue;
    person.asReviewer = {
      ...(person.asReviewer ?? {}),
      latestReviewAt: toIso(row.latest_review_at),
      recent30dReviewCount: row.recent_30d_review_count ?? 0,
    };
  }

  for (const row of crewResult.rows) {
    const person = peopleMap.get(row.github_id);
    if (!person) continue;
    person.asCrew = {
      ...(person.asCrew ?? {}),
      latestCrewActivityAt: toIso(row.latest_crew_activity_at),
    };
  }

  return people;
}
