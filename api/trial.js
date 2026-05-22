import prHandler from "./_lib/trial/pr.js";
import commentHandler from "./_lib/trial/comment.js";
import replyHandler from "./_lib/trial/reply.js";
import { sendError } from "./_lib/http.js";

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default function handler(request, response) {
  const action = firstQueryValue(request.query.action);

  if (action === "pr") return prHandler(request, response);
  if (action === "comment") return commentHandler(request, response);
  if (action === "reply") return replyHandler(request, response);

  sendError(response, 400, "invalid_trial_action", "action must be pr, comment, or reply");
}
