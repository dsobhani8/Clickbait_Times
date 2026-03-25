import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AppState, Text, View } from "react-native";
import {
  flushAnalyticsQueue,
  initializeAnalytics,
  trackEvent,
  stopAnalytics
} from "../services/analytics";
import { AuthProvider, useAuth } from "../state/auth";
import {
  ExperimentAssignmentProvider,
  useExperimentAssignment
} from "../state/experimentAssignment";
import { useUserIdentity, UserIdentityProvider } from "../state/userIdentity";
import { styles } from "../styles/news";

function createAppSessionId() {
  return `appsess_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function AnalyticsLifecycle() {
  const { userId } = useUserIdentity();
  const { arm, experimentKey, source } = useExperimentAssignment();
  const sessionRef = useRef<{ id: string; startedAtMs: number } | null>(null);

  useEffect(() => {
    function beginSession() {
      if (sessionRef.current) {
        return;
      }

      const appSessionId = createAppSessionId();
      sessionRef.current = {
        id: appSessionId,
        startedAtMs: Date.now()
      };

      trackEvent({
        eventType: "app_session_start",
        userId,
        surface: "article",
        properties: {
          appSessionId,
          experimentKey,
          experimentArm: arm,
          experimentSource: source
        }
      });
    }

    function endSession() {
      if (!sessionRef.current) {
        return;
      }

      const current = sessionRef.current;
      const seconds = Math.max(
        0,
        Math.round((Date.now() - current.startedAtMs) / 1000)
      );

      trackEvent({
        eventType: "app_session_end",
        userId,
        surface: "article",
        properties: {
          appSessionId: current.id,
          seconds,
          experimentKey,
          experimentArm: arm,
          experimentSource: source
        }
      });

      sessionRef.current = null;
    }

    beginSession();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        beginSession();
      }
      if (nextState === "inactive" || nextState === "background") {
        endSession();
      }
    });

    return () => {
      subscription.remove();
      endSession();
    };
  }, [arm, experimentKey, source, userId]);

  return null;
}

function AuthenticatedApp() {
  return (
    <>
      <AnalyticsLifecycle />
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#fffdf8" },
          headerShadowVisible: false,
          headerTintColor: "#151515",
          contentStyle: { backgroundColor: "#f7f2e8" }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ title: "My Account" }} />
        <Stack.Screen name="article/[id]" options={{ title: "Article" }} />
      </Stack>
    </>
  );
}

function UnauthenticatedApp() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#fffdf8" },
          headerShadowVisible: false,
          headerTintColor: "#151515",
          contentStyle: { backgroundColor: "#f7f2e8" }
        }}
      >
        <Stack.Screen name="login" options={{ title: "Sign In" }} />
      </Stack>
    </>
  );
}

function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={[styles.screen, { padding: 16 }]}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Checking session...</Text>
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <UnauthenticatedApp />;
  }

  return <AuthenticatedApp />;
}

export default function RootLayout() {
  useEffect(() => {
    initializeAnalytics();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "inactive" || nextState === "background") {
        void flushAnalyticsQueue();
      }
      if (nextState === "active") {
        void flushAnalyticsQueue();
      }
    });

    return () => {
      subscription.remove();
      void flushAnalyticsQueue();
      stopAnalytics();
    };
  }, []);

  return (
    <AuthProvider>
      <UserIdentityProvider>
        <ExperimentAssignmentProvider>
          <RootNavigator />
        </ExperimentAssignmentProvider>
      </UserIdentityProvider>
    </AuthProvider>
  );
}
