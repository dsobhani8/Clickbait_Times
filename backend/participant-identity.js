const DEFAULT_PARTICIPANT_LOGIN_EMAIL_DOMAIN =
  (process.env.PARTICIPANT_LOGIN_EMAIL_DOMAIN || "login.tailormadetimes.app")
    .trim()
    .toLowerCase();

function normalizeProlificPid(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function slugifyProlificPid(value) {
  return normalizeProlificPid(value)
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildParticipantLoginEmail(
  prolificPid,
  domain = DEFAULT_PARTICIPANT_LOGIN_EMAIL_DOMAIN
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

function parseParticipantLoginEmail(
  email,
  domain = DEFAULT_PARTICIPANT_LOGIN_EMAIL_DOMAIN
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

module.exports = {
  DEFAULT_PARTICIPANT_LOGIN_EMAIL_DOMAIN,
  normalizeProlificPid,
  buildParticipantLoginEmail,
  parseParticipantLoginEmail
};
