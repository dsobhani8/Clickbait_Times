import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  fallbackAssignArm,
  fetchExperimentConfig,
  type ExperimentArm
} from "../services/experiment";
import { useUserIdentity } from "./userIdentity";

type ExperimentAssignmentContextValue = {
  arm: ExperimentArm;
  source: string;
  isLoading: boolean;
  experimentKey: string;
  resolvedUserId: string | null;
};

const ExperimentAssignmentContext =
  createContext<ExperimentAssignmentContextValue | null>(null);

export function ExperimentAssignmentProvider({
  children
}: {
  children: ReactNode;
}) {
  const { userId } = useUserIdentity();
  const [arm, setArm] = useState<ExperimentArm>("neutral");
  const [source, setSource] = useState("initial");
  const [experimentKey, setExperimentKey] = useState("clickbait_tone_v1");
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveAssignment() {
      setIsLoading(true);
      setResolvedUserId(null);

      try {
        const remote = await fetchExperimentConfig(userId);
        if (cancelled) {
          return;
        }
        if (remote) {
          setArm(remote.arm);
          setSource(remote.source);
          setExperimentKey(remote.experimentKey);
          setResolvedUserId(userId);
        } else {
          const fallback = fallbackAssignArm(userId);
          setArm(fallback.arm);
          setSource(fallback.source);
          setExperimentKey(fallback.experimentKey);
          setResolvedUserId(userId);
        }
      } catch {
        if (!cancelled) {
          const fallback = fallbackAssignArm(userId);
          setArm(fallback.arm);
          setSource(fallback.source);
          setExperimentKey(fallback.experimentKey);
          setResolvedUserId(userId);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    resolveAssignment();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo(
    () => ({
      arm,
      source,
      isLoading,
      experimentKey,
      resolvedUserId
    }),
    [arm, source, isLoading, experimentKey, resolvedUserId]
  );

  return (
    <ExperimentAssignmentContext.Provider value={value}>
      {children}
    </ExperimentAssignmentContext.Provider>
  );
}

export function useExperimentAssignment() {
  const context = useContext(ExperimentAssignmentContext);
  if (!context) {
    throw new Error(
      "useExperimentAssignment must be used inside ExperimentAssignmentProvider."
    );
  }
  return context;
}
