import { formatDbError, withClient } from "../scripts/db/db.js";

const TRACK_LABELS = {
  backend: "BE",
  frontend: "FE",
  android: "AN",
};

function trackLabel(track) {
  return TRACK_LABELS[track] ?? track ?? null;
}

function formatTrackMeta(person) {
  const parts = [];
  if (person.cohort) parts.push(`${person.cohort}기`);
  if (person.track) parts.push(trackLabel(person.track));
  return parts.join(" ");
}

function serializePerson(row) {
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

function serializeMember(row) {
  const member = {
    githubId: row.github_id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    cohort: row.cohort,
    roles: row.roles ?? [],
    track: row.track,
  };

  member.displayName = member.nickname ?? member.githubId;
  member.displayMeta = [formatTrackMeta(member), `@${member.githubId}`].filter(Boolean).join(" · ");

  return member;
}

function serializeActivity(row) {
  return {
    githubId: row.github_id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    role: row.role,
    track: row.track,
    trackLabel: trackLabel(row.track),
    repo: row.repo_full_name,
    prNumber: row.pr_number,
    eventType: row.event_type,
    occurredAt: row.occurred_at?.toISOString?.() ?? row.occurred_at,
    url: row.url,
  };
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export async function loadOverviewFromDb(client) {
  const summaryResult = await client.query(`
      select
        (select count(*)::int from pull_requests) as total_prs,
        (select count(*)::int from review_events) as total_review_events,
        (select count(*)::int from review_events where author_role = 'reviewer') as total_reviewer_events,
        (select count(*)::int from repos) as total_repos,
        (select count(distinct repo_id)::int from pull_requests) as active_repos,
        (select count(*)::int from members) as total_members,
        (select count(*)::int from person_summary_stats) as total_people,
        (
          select max(finished_at)
          from sync_runs
          where status = 'success'
        ) as source_generated_at,
        (
          select max(activity_at)
          from (
            select max(created_at) as activity_at from pull_requests
            union all
            select max(submitted_at) as activity_at from review_events
          ) activity
        ) as latest_activity_at
    `);
  const peopleResult = await client.query(`
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
  const membersResult = await client.query(`
      select
        github_id,
        nickname,
        avatar_url,
        cohort,
        roles,
        track
      from members
      order by coalesce(cohort, 0) desc, coalesce(nickname, github_id), github_id
    `);
  const trackResult = await client.query(`
      select
        track,
        sum((summary->>'prCount')::int)::int as prs
      from repo_summary_stats
      group by track
      order by prs desc
    `);
  const recentResult = await client.query(`
      select
        github_id,
        nickname,
        avatar_url,
        role,
        track,
        repo_full_name,
        pr_number,
        event_type,
        occurred_at,
        url
      from recent_activities
      order by role, occurred_at desc
    `);

  const generatedAt = new Date().toISOString();
  const summaryRow = summaryResult.rows[0];
  const members = membersResult.rows.map(serializeMember);
  const people = peopleResult.rows.map(serializePerson);
  const peopleMap = Object.fromEntries(people.map((person) => [person.githubId, person]));
  const recentRows = recentResult.rows.map(serializeActivity);
  const recentActivity = {
    generatedAt: new Date().toISOString(),
    crew: recentRows.filter((item) => item.role === "crew"),
    reviewers: recentRows.filter((item) => item.role === "reviewer"),
  };

  const trackDistribution = trackResult.rows.map((row) => ({
    track: row.track,
    trackLabel: trackLabel(row.track),
    prs: row.prs,
    percent: percent(row.prs, summaryRow.total_prs),
  }));

  return {
    source: "db",
    generatedAt,
    members,
    people,
    peopleMap,
    personStats: {
      generatedAt,
      sourceGeneratedAt: summaryRow.source_generated_at?.toISOString?.() ?? null,
      people: peopleMap,
    },
    summary: {
      generatedAt,
      sourceGeneratedAt: summaryRow.source_generated_at?.toISOString?.() ?? null,
      membersGeneratedAt: null,
      latestActivityAt: summaryRow.latest_activity_at?.toISOString?.() ?? null,
      totalPRs: summaryRow.total_prs,
      totalReviewEvents: summaryRow.total_review_events,
      totalReviewerEvents: summaryRow.total_reviewer_events,
      totalRepos: summaryRow.total_repos,
      activeRepos: summaryRow.active_repos,
      totalMembers: summaryRow.total_members,
      totalPeople: summaryRow.total_people,
      trackDistribution,
    },
    recentActivity,
  };
}

export default async function handler(_request, response) {
  try {
    const payload = await withClient(loadOverviewFromDb);
    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    response.status(200).json(payload);
  } catch (error) {
    response.status(500).json({
      error: "overview_load_failed",
      message: formatDbError(error),
    });
  }
}
