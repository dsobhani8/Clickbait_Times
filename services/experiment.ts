import AsyncStorage from "@react-native-async-storage/async-storage";

export type ExperimentArm = "neutral" | "clickbait";
export type ExperimentContentVariant = "facts_only" | "clickbait";

export type ExperimentConfig = {
  experimentKey: string;
  arm: ExperimentArm;
  source: string;
  userId: string | null;
  bucket: number | null;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "";
const EXPERIMENT_KEY = "clickbait_tone_v1";
const ASSIGNMENT_UNIT_ID_STORAGE_KEY = "experiment_assignment_unit_id_v1";

let assignmentUnitIdCache: string | null = null;

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createAnonymousAssignmentUnitId() {
  return `anon_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export async function getOrCreateAssignmentUnitId(): Promise<string> {
  if (assignmentUnitIdCache) {
    return assignmentUnitIdCache;
  }

  try {
    const stored = await AsyncStorage.getItem(ASSIGNMENT_UNIT_ID_STORAGE_KEY);
    if (stored && stored.length > 0) {
      assignmentUnitIdCache = stored;
      return stored;
    }

    const created = createAnonymousAssignmentUnitId();
    assignmentUnitIdCache = created;
    await AsyncStorage.setItem(ASSIGNMENT_UNIT_ID_STORAGE_KEY, created);
    return created;
  } catch {
    const fallback = "anon_fallback";
    assignmentUnitIdCache = fallback;
    return fallback;
  }
}

export function assignArticleVariantsForFeed(
  arm: ExperimentArm,
  assignmentUnitId: string,
  articleIds: string[],
  experimentKey: string = EXPERIMENT_KEY
): Record<string, ExperimentContentVariant> {
  const assignments: Record<string, ExperimentContentVariant> = {};
  const normalizedIds = articleIds.filter(
    (articleId) => typeof articleId === "string" && articleId.length > 0
  );

  if (normalizedIds.length === 0) {
    return assignments;
  }

  if (arm !== "clickbait") {
    for (const articleId of normalizedIds) {
      assignments[articleId] = "facts_only";
    }
    return assignments;
  }

  const normalizedAssignmentUnitId =
    typeof assignmentUnitId === "string" && assignmentUnitId.length > 0
      ? assignmentUnitId
      : "anon_fallback";
  const ranked = normalizedIds
    .map((articleId) => ({
      articleId,
      score: hashString(`${experimentKey}:${normalizedAssignmentUnitId}:${articleId}`)
    }))
    .sort((a, b) =>
      a.score === b.score ? a.articleId.localeCompare(b.articleId) : a.score - b.score
    );

  const baseClickbaitCount = Math.floor(ranked.length / 2);
  const oddBiasToClickbait =
    hashString(`${experimentKey}:${normalizedAssignmentUnitId}:odd_bias`) % 2 === 0;
  const clickbaitCount =
    ranked.length % 2 === 0
      ? baseClickbaitCount
      : baseClickbaitCount + (oddBiasToClickbait ? 1 : 0);

  for (let index = 0; index < ranked.length; index += 1) {
    assignments[ranked[index].articleId] =
      index < clickbaitCount ? "clickbait" : "facts_only";
  }

  return assignments;
}

export function fallbackAssignArm(userId: string): ExperimentConfig {
  const bucket = hashString(`${EXPERIMENT_KEY}:${userId}`) % 100;
  const arm: ExperimentArm = bucket < 50 ? "neutral" : "clickbait";
  return {
    experimentKey: EXPERIMENT_KEY,
    arm,
    source: "client_fallback_hash",
    userId,
    bucket
  };
}

export async function fetchExperimentConfig(
  userId: string
): Promise<ExperimentConfig | null> {
  if (!API_BASE_URL) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("userId", userId);
  const response = await fetch(`${API_BASE_URL}/config?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Experiment config failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const experiment = json?.experiment;
  if (!experiment) {
    return null;
  }

  const arm = String(experiment.arm || "").toLowerCase();
  if (arm !== "neutral" && arm !== "clickbait") {
    return null;
  }

  const bucket = Number(experiment.bucket);
  return {
    experimentKey:
      typeof experiment.experimentKey === "string" && experiment.experimentKey.length > 0
        ? experiment.experimentKey
        : EXPERIMENT_KEY,
    arm,
    source:
      typeof experiment.source === "string" && experiment.source.length > 0
        ? experiment.source
        : "backend",
    userId:
      typeof experiment.userId === "string" && experiment.userId.length > 0
        ? experiment.userId
        : userId,
    bucket: Number.isFinite(bucket) ? bucket : null
  };
}
