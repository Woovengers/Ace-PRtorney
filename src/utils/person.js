const TRACK_LABELS = {
  backend: "BE",
  frontend: "FE",
  android: "AN",
};

export function trackLabel(track) {
  return TRACK_LABELS[track] ?? track ?? "";
}

export function hasRole(person, role) {
  return Array.isArray(person?.roles) && person.roles.includes(role);
}

export function isCoachOnly(person) {
  return hasRole(person, "coach") && !hasRole(person, "crew") && !hasRole(person, "reviewer");
}

export function isPreferredCrew(person) {
  return Boolean(person?.asCrew?.hasData && hasRole(person, "crew"));
}

export function displayName(person) {
  return person?.nickname || person?.displayName || person?.githubId || "unknown";
}

export function displayMeta(person) {
  if (isCoachOnly(person)) {
    return ["Coach", person?.githubId ? `@${person.githubId}` : null].filter(Boolean).join(" · ");
  }
  if (person?.displayMeta) return person.displayMeta;
  const meta = [person?.cohort ? `${person.cohort}기` : null, trackLabel(person?.track)]
    .filter(Boolean)
    .join(" ");
  return [meta, person?.githubId ? `@${person.githubId}` : null].filter(Boolean).join(" · ");
}

export function personInitial(person) {
  const name = displayName(person);
  return name.slice(0, 1).toUpperCase();
}
