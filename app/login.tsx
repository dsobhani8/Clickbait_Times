import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../state/auth";
import { styles } from "../styles/news";

type LoginStep = "request_code" | "verify_code";
const RESEND_COOLDOWN_SECONDS = 60;

export default function LoginRoute() {
  const { sendOtp, verifyOtp, isLoading, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<LoginStep>("request_code");
  const [pending, setPending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }
    const intervalId = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      clearInterval(intervalId);
    };
  }, [cooldownSeconds]);

  async function handleSendCode() {
    if (cooldownSeconds > 0) {
      return;
    }
    try {
      setPending(true);
      setError(null);
      setMessage(null);
      await sendOtp(email);
      setStep("verify_code");
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      setMessage("Code sent. Check your email and enter the OTP.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyCode() {
    try {
      setPending(true);
      setError(null);
      setMessage(null);
      await verifyOtp(email, code);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify code.");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={[styles.screen, { padding: 16, justifyContent: "center" }]}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>TailorMadeTimes Pilot</Text>
        <Text style={styles.heroTitle}>Sign In</Text>
        <Text style={styles.heroSubtitle}>
          Enter your email to receive a one-time login code.
        </Text>
      </View>

      <View style={[styles.loadingCard, { gap: 10, marginTop: 12 }]}>
        <Text style={styles.metaText}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          style={{
            borderWidth: 1,
            borderColor: "#d0d0d0",
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: "white"
          }}
        />

        {step === "verify_code" ? (
          <>
            <Text style={styles.metaText}>One-time code</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              style={{
                borderWidth: 1,
                borderColor: "#d0d0d0",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: "white"
              }}
            />
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.metaText}>{message}</Text> : null}

        {step === "request_code" ? (
          <Pressable
            disabled={pending || cooldownSeconds > 0}
            onPress={handleSendCode}
            style={({ pressed }) => [
              styles.categoryChip,
              styles.categoryChipActive,
              {
                opacity: pending || cooldownSeconds > 0 ? 0.7 : pressed ? 0.85 : 1,
                alignItems: "center"
              }
            ]}
          >
            <Text style={styles.categoryChipTextActive}>
              {pending
                ? "Sending..."
                : cooldownSeconds > 0
                  ? `Send Code (${cooldownSeconds}s)`
                  : "Send Code"}
            </Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              disabled={pending}
              onPress={handleVerifyCode}
              style={({ pressed }) => [
                styles.categoryChip,
                styles.categoryChipActive,
                { opacity: pending ? 0.7 : pressed ? 0.85 : 1, alignItems: "center" }
              ]}
            >
              <Text style={styles.categoryChipTextActive}>
                {pending ? "Verifying..." : "Verify and Sign In"}
              </Text>
            </Pressable>

            <Pressable
              disabled={pending || cooldownSeconds > 0}
              onPress={handleSendCode}
              style={({ pressed }) => [
                styles.categoryChip,
                {
                  opacity: pending || cooldownSeconds > 0 ? 0.7 : pressed ? 0.85 : 1,
                  alignItems: "center"
                }
              ]}
            >
              <Text style={styles.categoryChipText}>
                {cooldownSeconds > 0
                  ? `Resend Code (${cooldownSeconds}s)`
                  : "Resend Code"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
