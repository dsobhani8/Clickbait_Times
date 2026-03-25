import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useAuth } from "./auth";

type UserIdentityContextValue = {
  userId: string;
  setUserId: (nextUserId: string) => void;
  availableUserIds: string[];
  devUserSwitchEnabled: boolean;
};

const DEV_USER_SWITCH_ENABLED =
  (process.env.EXPO_PUBLIC_ENABLE_DEV_USER_SWITCH || "").trim() === "1";
const DEFAULT_DEV_USER_IDS = ["pilot_neutral_1", "pilot_clickbait_1"];
const ACTIVE_DEV_USER_STORAGE_KEY = "active_dev_user_v1";

const UserIdentityContext = createContext<UserIdentityContextValue | null>(null);

export function UserIdentityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const canonicalUserId =
    typeof user?.id === "string" && user.id.length > 0 ? user.id : "anonymous";
  const [userId, setUserId] = useState<string>(canonicalUserId);
  const [hasLoadedUser, setHasLoadedUser] = useState(false);

  useEffect(() => {
    if (!DEV_USER_SWITCH_ENABLED) {
      setUserId(canonicalUserId);
      setHasLoadedUser(true);
      return () => {
        // no-op
      };
    }

    let cancelled = false;

    async function loadUser() {
      try {
        const storedActiveUserId = await AsyncStorage.getItem(
          ACTIVE_DEV_USER_STORAGE_KEY
        );

        if (cancelled) {
          return;
        }

        if (
          typeof storedActiveUserId === "string" &&
          storedActiveUserId.trim().length > 0 &&
          [canonicalUserId, ...DEFAULT_DEV_USER_IDS].includes(
            storedActiveUserId.trim()
          )
        ) {
          setUserId(storedActiveUserId.trim());
          return;
        }
        setUserId(canonicalUserId);
      } finally {
        if (!cancelled) {
          setHasLoadedUser(true);
        }
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [canonicalUserId]);

  useEffect(() => {
    if (!hasLoadedUser) {
      return;
    }
    if (!DEV_USER_SWITCH_ENABLED) {
      return;
    }

    const normalized = userId.trim();
    if (!normalized) {
      return;
    }

    AsyncStorage.setItem(ACTIVE_DEV_USER_STORAGE_KEY, normalized).catch(() => {
      // Ignore write failures in prototype mode.
    });
  }, [hasLoadedUser, userId]);

  const availableUserIds = useMemo(() => {
    if (!DEV_USER_SWITCH_ENABLED) {
      return [canonicalUserId];
    }
    return Array.from(new Set([canonicalUserId, ...DEFAULT_DEV_USER_IDS]));
  }, [canonicalUserId]);

  function handleSetUserId(nextUserId: string) {
    if (!DEV_USER_SWITCH_ENABLED) {
      return;
    }
    const normalized = nextUserId.trim();
    if (!normalized) {
      return;
    }
    if (!availableUserIds.includes(normalized)) {
      return;
    }
    setUserId(normalized);
  }

  return (
    <UserIdentityContext.Provider
      value={{
        userId,
        setUserId: handleSetUserId,
        availableUserIds,
        devUserSwitchEnabled: DEV_USER_SWITCH_ENABLED
      }}
    >
      {children}
    </UserIdentityContext.Provider>
  );
}

export function useUserIdentity() {
  const context = useContext(UserIdentityContext);

  if (!context) {
    throw new Error("useUserIdentity must be used inside UserIdentityProvider.");
  }

  return context;
}
