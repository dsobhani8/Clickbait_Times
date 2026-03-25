const EXPERIMENT_KEY = "clickbait_tone_v1";
const VALID_ARMS = Object.freeze(["neutral", "clickbait"]);
const FORCED_ARM = normalizeArm(process.env.EXPERIMENT_FORCE_ARM || "");
const FIXED_TEST_USER_ASSIGNMENTS = Object.freeze({
  pilot_neutral_1: "neutral",
  pilot_clickbait_1: "clickbait"
});

function normalizeArm(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return VALID_ARMS.includes(normalized) ? normalized : "";
}

function normalizeUserId(value) {
  if (typeof value !== "string") {
    return "anonymous";
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "anonymous";
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function assignArmForUser(userId) {
  const normalizedUserId = normalizeUserId(userId);
  const bucket = hashString(`${EXPERIMENT_KEY}:${normalizedUserId}`) % 100;
  const arm = bucket < 50 ? "neutral" : "clickbait";
  return { arm, bucket, userId: normalizedUserId };
}

function getClickbaitExperimentAssignment({ userId } = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const fixedArm = FIXED_TEST_USER_ASSIGNMENTS[normalizedUserId];
  if (fixedArm) {
    return {
      experimentKey: EXPERIMENT_KEY,
      arm: fixedArm,
      source: "test_fixed",
      bucket: null,
      userId: normalizedUserId
    };
  }

  if (FORCED_ARM) {
    return {
      experimentKey: EXPERIMENT_KEY,
      arm: FORCED_ARM,
      source: "forced_env",
      bucket: null,
      userId: normalizedUserId
    };
  }

  const assignment = assignArmForUser(normalizedUserId);
  return {
    experimentKey: EXPERIMENT_KEY,
    arm: assignment.arm,
    source: "hash",
    bucket: assignment.bucket,
    userId: assignment.userId
  };
}

module.exports = {
  EXPERIMENT_KEY,
  VALID_ARMS,
  normalizeArm,
  normalizeUserId,
  FIXED_TEST_USER_ASSIGNMENTS,
  getClickbaitExperimentAssignment
};
