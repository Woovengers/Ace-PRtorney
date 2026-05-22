import crypto from "node:crypto";

const AUTH_COOKIE = "ace_prtorney_gh";
const STATE_COOKIE = "ace_prtorney_oauth_state";
const MAX_AGE = 60 * 60 * 24 * 7;

function cookieOptions({ httpOnly = true, maxAge = MAX_AGE } = {}) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}${httpOnly ? "; HttpOnly" : ""}`;
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function cookieSecret() {
  const secret = process.env.GITHUB_APP_COOKIE_SECRET
    || process.env.GITHUB_OAUTH_COOKIE_SECRET
    || process.env.GITHUB_APP_CLIENT_SECRET
    || process.env.GITHUB_CLIENT_SECRET;
  if (!secret) {
    throw new Error("GITHUB_APP_COOKIE_SECRET or GITHUB_APP_CLIENT_SECRET is required");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", cookieSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt(value) {
  const payload = Buffer.from(value, "base64url");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", cookieSecret(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function appendSetCookie(response, cookie) {
  const existing = response.getHeader?.("Set-Cookie");
  const next = existing ? [existing].flat().concat(cookie) : cookie;
  response.setHeader("Set-Cookie", next);
}

export function getOrigin(request) {
  const proto = request.headers["x-forwarded-proto"] ?? "http";
  const host = request.headers["x-forwarded-host"] ?? request.headers.host;
  return `${proto}://${host}`;
}

export function setOAuthStateCookie(response, state) {
  appendSetCookie(response, `${STATE_COOKIE}=${encodeURIComponent(state)}; ${cookieOptions({ maxAge: 60 * 10 })}`);
}

export function readOAuthStateCookie(request) {
  return parseCookies(request)[STATE_COOKIE] ?? null;
}

export function clearOAuthStateCookie(response) {
  appendSetCookie(response, `${STATE_COOKIE}=; ${cookieOptions({ maxAge: 0 })}`);
}

export function setGithubSessionCookie(response, session) {
  appendSetCookie(response, `${AUTH_COOKIE}=${encodeURIComponent(encrypt(JSON.stringify(session)))}; ${cookieOptions()}`);
}

export function clearGithubSessionCookie(response) {
  appendSetCookie(response, `${AUTH_COOKIE}=; ${cookieOptions({ maxAge: 0 })}`);
}

export function readGithubSession(request) {
  const raw = parseCookies(request)[AUTH_COOKIE];
  if (!raw) return null;
  try {
    return JSON.parse(decrypt(raw));
  } catch {
    return null;
  }
}

export function requireGithubSession(request) {
  const session = readGithubSession(request);
  if (!session?.accessToken) {
    throw new Error("GitHub login is required");
  }
  return session;
}
