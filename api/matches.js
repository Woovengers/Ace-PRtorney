import { formatDbError, withClient } from "../scripts/db/db.js";
import { methodNotAllowed, sendError, sendJson } from "./_lib/http.js";
import { enrichPeopleActivity, loadPeople, loadRecentReferenceAt } from "./_lib/people.js";
import { calculateReviewerMatches } from "../src/utils/reviewerMatch.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const { crewGithubId } = request.query;
  if (!crewGithubId) {
    sendError(response, 400, "invalid_match_request", "crewGithubId is required");
    return;
  }

  try {
    const payload = await withClient(async (client) => {
      const recentReferenceAt = await loadRecentReferenceAt(client);
      const people = await enrichPeopleActivity(client, await loadPeople(client), recentReferenceAt);
      const crew = people.find((person) => person.githubId === crewGithubId);
      if (!crew?.asCrew?.hasData) return null;

      return {
        crew,
        recentReferenceAt,
        matches: calculateReviewerMatches(crew, people, {
          sameTrackOnly: true,
          requireRecentReviewerActivity: true,
          recentReferenceAt,
        }),
      };
    });

    if (!payload) {
      sendError(response, 404, "crew_not_found", "Crew not found or has no crew data");
      return;
    }

    sendJson(response, 200, payload, "s-maxage=120, stale-while-revalidate=600");
  } catch (error) {
    sendError(response, 500, "api_failed", formatDbError(error));
  }
}
