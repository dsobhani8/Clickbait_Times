const DEFAULT_PARTICIPANT_LOGIN_EMAIL_DOMAIN = (
  process.env.EXPO_PUBLIC_PARTICIPANT_LOGIN_EMAIL_DOMAIN ||
  "login.tailormadetimes.app"
)
  .trim()
  .toLowerCase();

export function normalizeProlificPid(value: string) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function slugifyProlificPid(value: string) {
  return normalizeProlificPid(value)
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildParticipantLoginEmail(
  prolificPid: string,
  domain: string = DEFAULT_PARTICIPANT_LOGIN_EMAIL_DOMAIN
) {
  const normalizedPid = slugifyProlificPid(prolificPid);
  const normalizedDomain =
    typeof domain === "string" && domain.trim().length > 0
      ? domain.trim().toLowerCase()
      : DEFAULT_PARTICIPANT_LOGIN_EMAIL_DOMAIN;
  if (!normalizedPid) {
    return "";
  }
  return `participant-${normalizedPid}@${normalizedDomain}`;
}

export function parseParticipantLoginEmail(
  email: string | null | undefined,
  domain: string = DEFAULT_PARTICIPANT_LOGIN_EMAIL_DOMAIN
) {
  if (typeof email !== "string") {
    return "";
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDomain =
    typeof domain === "string" && domain.trim().length > 0
      ? domain.trim().toLowerCase()
      : DEFAULT_PARTICIPANT_LOGIN_EMAIL_DOMAIN;
  const suffix = `@${normalizedDomain}`;
  if (!normalizedEmail.endsWith(suffix)) {
    return "";
  }
  const prefix = normalizedEmail.slice(0, -suffix.length);
  if (!prefix.startsWith("participant-")) {
    return "";
  }
  return prefix.slice("participant-".length);
}
