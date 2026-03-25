import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

type AuthUser = {
  id: string;
  email: string | null;
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
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
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

function shouldRetryOtpAsSignup(payload: unknown) {
  if (!isRecord(payload)) {
    return false;
  }
  const raw =
    (typeof payload.error_description === "string" && payload.error_description) ||
    (typeof payload.msg === "string" && payload.msg) ||
    (typeof payload.message === "string" && payload.message) ||
    (typeof payload.error === "string" && payload.error) ||
    "";
  const message = raw.toLowerCase();
  return (
    message.includes("user not found") ||
    message.includes("no user found") ||
    message.includes("not found")
  );
}

function normalizeOtpToken(tokenRaw: string) {
  if (typeof tokenRaw !== "string") {
    return "";
  }
  return tokenRaw
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9A-Za-z]/g, "")
    .trim();
}

function readSessionFromJson(value: unknown): StoredAuthSession | null {
  if (!isRecord(value)) return null;
  const accessToken = typeof value.accessToken === "string" ? value.accessToken : "";
  const refreshToken = typeof value.refreshToken === "string" ? value.refreshToken : "";
  const expiresAtMs = Number(value.expiresAtMs);
  const user = isRecord(value.user) ? value.user : null;
  const userId = user && typeof user.id === "string" ? user.id : "";
  const userEmail = user && typeof user.email === "string" ? user.email : null;
  if (!accessToken || !refreshToken || !Number.isFinite(expiresAtMs) || !userId) {
    return null;
  }
  return {
    accessToken,
    refreshToken,
    expiresAtMs,
    user: {
      id: userId,
      email: userEmail
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
      email: userEmail
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

  async function sendOtp(emailRaw: string) {
    ensureSupabaseConfigured();
    const email = emailRaw.trim().toLowerCase();
    if (!email) {
      throw new Error("Email is required.");
    }

    async function requestOtp(createUser: boolean) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
        method: "POST",
        headers: toHeaders(),
        body: JSON.stringify({
          email,
          create_user: createUser
        })
      });
      const payload = await response.json().catch(() => ({}));
      return { response, payload };
    }

    // First try sign-in flow for existing users.
    const firstAttempt = await requestOtp(false);
    if (firstAttempt.response.ok) {
      return;
    }

    // If account doesn't exist yet, allow first-time signup.
    if (shouldRetryOtpAsSignup(firstAttempt.payload)) {
      const secondAttempt = await requestOtp(true);
      if (secondAttempt.response.ok) {
        return;
      }
      throw new Error(
        parseApiError(secondAttempt.payload, "Failed to send login code.")
      );
    }

    throw new Error(
      parseApiError(firstAttempt.payload, "Failed to send login code.")
    );
  }

  async function verifyOtp(emailRaw: string, tokenRaw: string) {
    ensureSupabaseConfigured();
    const email = emailRaw.trim().toLowerCase();
    const token = normalizeOtpToken(tokenRaw);
    if (!email || !token) {
      throw new Error("Email and code are required.");
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: toHeaders(),
      body: JSON.stringify({
        type: "email",
        email,
        token
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = parseApiError(payload, "Invalid or expired login code.");
      throw new Error(`OTP verify failed (${response.status}): ${reason}`);
    }

    const nextSession = toSessionFromSupabasePayload(payload);
    if (!nextSession) {
      throw new Error("Verify response did not include a valid session.");
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
      sendOtp,
      verifyOtp,
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
