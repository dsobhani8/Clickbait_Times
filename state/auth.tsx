import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  buildParticipantLoginEmail,
  normalizeProlificPid,
  parseParticipantLoginEmail
} from "../utils/participantIdentity";

type AuthUser = {
  id: string;
  email: string | null;
  loginId: string | null;
};

type StoredAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
  user: AuthUser;
};

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  signInWithPassword: (loginId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SESSION_STORAGE_KEY = "supabase_auth_session_v1";
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();

const AuthContext = createContext<AuthContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
}

function toHeaders(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    ...extra
  };
}

function parseApiError(payload: unknown, fallback: string) {
  if (!isRecord(payload)) {
    return fallback;
  }
  const maybeMessage =
    (typeof payload.error_description === "string" && payload.error_description) ||
    (typeof payload.msg === "string" && payload.msg) ||
    (typeof payload.message === "string" && payload.message) ||
    (typeof payload.error === "string" && payload.error);
  return maybeMessage || fallback;
}

function resolveLoginId(user: Record<string, unknown> | null, email: string | null) {
  const metadata = user && isRecord(user.user_metadata) ? user.user_metadata : null;
  const metadataLoginId =
    metadata &&
    (typeof metadata.prolific_pid === "string"
      ? metadata.prolific_pid
      : typeof metadata.login_id === "string"
        ? metadata.login_id
        : "");
  const normalizedMetadataLoginId = normalizeProlificPid(metadataLoginId || "");
  if (normalizedMetadataLoginId) {
    return normalizedMetadataLoginId;
  }
  return parseParticipantLoginEmail(email);
}

function readSessionFromJson(value: unknown): StoredAuthSession | null {
  if (!isRecord(value)) return null;
  const accessToken = typeof value.accessToken === "string" ? value.accessToken : "";
  const refreshToken = typeof value.refreshToken === "string" ? value.refreshToken : "";
  const expiresAtMs = Number(value.expiresAtMs);
  const user = isRecord(value.user) ? value.user : null;
  const userId = user && typeof user.id === "string" ? user.id : "";
  const userEmail = user && typeof user.email === "string" ? user.email : null;
  const userLoginId = user && typeof user.loginId === "string" ? user.loginId : null;
  if (!accessToken || !refreshToken || !Number.isFinite(expiresAtMs) || !userId) {
    return null;
  }
  return {
    accessToken,
    refreshToken,
    expiresAtMs,
    user: {
      id: userId,
      email: userEmail,
      loginId: userLoginId
    }
  };
}

function toSessionFromSupabasePayload(payload: unknown): StoredAuthSession | null {
  if (!isRecord(payload)) return null;
  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : "";
  const refreshToken =
    typeof payload.refresh_token === "string" ? payload.refresh_token : "";
  const expiresAtSecondsRaw =
    Number(payload.expires_at) ||
    (Number.isFinite(Number(payload.expires_in))
      ? Math.floor(Date.now() / 1000) + Number(payload.expires_in)
      : NaN);
  const user = isRecord(payload.user) ? payload.user : null;
  const userId = user && typeof user.id === "string" ? user.id : "";
  const userEmail = user && typeof user.email === "string" ? user.email : null;
  const userLoginId = resolveLoginId(user, userEmail);
  if (
    !accessToken ||
    !refreshToken ||
    !userId ||
    !Number.isFinite(expiresAtSecondsRaw)
  ) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAtMs: Math.max(0, expiresAtSecondsRaw * 1000),
    user: {
      id: userId,
      email: userEmail,
      loginId: userLoginId || null
    }
  };
}

async function refreshSession(session: StoredAuthSession): Promise<StoredAuthSession> {
  ensureSupabaseConfigured();
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: toHeaders(),
      body: JSON.stringify({
        refresh_token: session.refreshToken
      })
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseApiError(payload, "Failed to refresh auth session."));
  }
  const refreshed = toSessionFromSupabasePayload(payload);
  if (!refreshed) {
    throw new Error("Refresh token response did not include a valid session.");
  }
  return refreshed;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<StoredAuthSession | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      try {
        const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (cancelled || !raw) {
          return;
        }

        const parsed = readSessionFromJson(JSON.parse(raw));
        if (!parsed) {
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          return;
        }

        const expiresSoon = parsed.expiresAtMs <= Date.now() + 60_000;
        if (expiresSoon) {
          try {
            const refreshed = await refreshSession(parsed);
            if (cancelled) return;
            setSession(refreshed);
            await AsyncStorage.setItem(
              SESSION_STORAGE_KEY,
              JSON.stringify(refreshed)
            );
            return;
          } catch {
            await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
            return;
          }
        }

        setSession(parsed);
      } catch {
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {
          // Ignore cleanup failures.
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    hydrateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function signInWithPassword(loginIdRaw: string, passwordRaw: string) {
    ensureSupabaseConfigured();
    const loginId = normalizeProlificPid(loginIdRaw);
    const password = passwordRaw.trim();
    if (!loginId || !password) {
      throw new Error("Prolific ID and password are required.");
    }

    const email = buildParticipantLoginEmail(loginId);
    if (!email) {
      throw new Error("Invalid Prolific ID.");
    }

    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: toHeaders(),
        body: JSON.stringify({
          email,
          password
        })
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = parseApiError(payload, "Invalid Prolific ID or password.");
      throw new Error(`Sign-in failed (${response.status}): ${reason}`);
    }

    const nextSession = toSessionFromSupabasePayload(payload);
    if (!nextSession) {
      throw new Error("Sign-in response did not include a valid session.");
    }

    setSession(nextSession);
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
  }

  async function signOut() {
    const current = session;
    setSession(null);
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);

    if (!current) return;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: toHeaders({
        Authorization: `Bearer ${current.accessToken}`
      })
    }).catch(() => {
      // Ignore sign-out network failures in MVP mode.
    });
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(session?.user?.id),
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      signInWithPassword,
      signOut
    }),
    [isLoading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
