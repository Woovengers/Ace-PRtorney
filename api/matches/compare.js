import { formatDbError, withClient } from "../../scripts/db/db.js";
import { methodNotAllowed, sendError, sendJson } from "../_lib/http.js";
import { enrichPeopleActivity, loadPeople, loadRecentReferenceAt } from "../_lib/people.js";
import { compareReviewerCandidates } from "../../src/utils/reviewerMatch.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body ?? {};
  const crewGithubId = body.crewGithubId;
  const candidateReviewerGithubIds = Array.isArray(body.candidateReviewerGithubIds)
    ? body.candidateReviewerGithubIds
    : [];

  if (!crewGithubId || candidateReviewerGithubIds.length === 0) {
    sendError(response, 400, "invalid_compare_request", "crewGithubId and candidateReviewerGithubIds are required");
    return;
  }

  try {
    const payload = await withClient(async (client) => {
      const recentReferenceAt = await loadRecentReferenceAt(client);
      const people = await enrichPeopleActivity(client, await loadPeople(client), recentReferenceAt);
      const peopleMap = new Map(people.map((person) => [person.githubId, person]));
      const crew = peopleMap.get(crewGithubId);
      if (!crew?.asCrew?.hasData) return null;

      const result = compareReviewerCandidates(crew, people, candidateReviewerGithubIds, {
        includeDifferentTrackWithPenalty: Boolean(body.includeDifferentTrackWithPenalty),
        requireRecentReviewerActivity: true,
        recentReferenceAt,
      });

      return {
        crew,
        recentReferenceAt,
        matches: result.matches,
        excludedCandidates: result.excludedCandidates,
      };
    });

    if (!payload) {
      sendError(response, 404, "crew_not_found", "Crew not found or has no crew data");
      return;
    }

    sendJson(response, 200, payload);
  } catch (error) {
    sendError(response, 500, "api_failed", formatDbError(error));
  }
}
