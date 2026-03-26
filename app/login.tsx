import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { useAuth } from "../state/auth";
import { styles } from "../styles/news";

export default function LoginRoute() {
  const { signInWithPassword, isLoading, isAuthenticated } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading]);

  async function handleSignIn() {
    try {
      setPending(true);
      setError(null);
      await signInWithPassword(loginId, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { flex: 1 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>TailorMadeTimes Pilot</Text>
          <Text style={styles.heroTitle}>Sign In</Text>
          <Text style={styles.heroSubtitle}>
            Enter your Prolific ID, not the hidden login email.
          </Text>
        </View>

        <View style={[styles.loadingCard, { gap: 10, marginTop: 12 }]}>
          <Text style={styles.metaText}>Prolific ID</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            returnKeyType="next"
            value={loginId}
            onChangeText={setLoginId}
            placeholder="65c10e1bba59f80070501946"
            style={{
              borderWidth: 1,
              borderColor: "#d0d0d0",
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: "white"
            }}
          />

          <Text style={styles.metaText}>Password</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            returnKeyType="done"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => {
              if (!pending) {
                void handleSignIn();
              }
            }}
            placeholder="Enter password"
            style={{
              borderWidth: 1,
              borderColor: "#d0d0d0",
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: "white"
            }}
          />

          <Text style={styles.metaText}>
            Example test login: `pilot_neutral_alpha` / `testpass123`
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            disabled={pending}
            onPress={handleSignIn}
            style={({ pressed }) => [
              styles.categoryChip,
              styles.categoryChipActive,
              { opacity: pending ? 0.7 : pressed ? 0.85 : 1, alignItems: "center" }
            ]}
          >
            <Text style={styles.categoryChipTextActive}>
              {pending ? "Signing In..." : "Sign In"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
