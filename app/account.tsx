import { Redirect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "../state/auth";
import { useUserIdentity } from "../state/userIdentity";
import { styles } from "../styles/news";

export default function AccountRoute() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const { userId } = useUserIdentity();

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.accountScreen]}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading account...</Text>
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={[styles.screen, styles.accountScreen]}>
      <View style={styles.accountCard}>
        <Text style={styles.accountTitle}>My Account</Text>

        <View style={styles.accountField}>
          <Text style={styles.accountFieldLabel}>Prolific ID</Text>
          <Text style={styles.accountFieldValue}>
            {user?.loginId || user?.email || "Unknown"}
          </Text>
        </View>

        <View style={styles.accountField}>
          <Text style={styles.accountFieldLabel}>User ID</Text>
          <Text style={styles.accountFieldValue}>{userId}</Text>
        </View>

        <Pressable
          onPress={() => {
            void signOut();
          }}
          style={({ pressed }) => [
            styles.accountSignOutButton,
            pressed && styles.accountSignOutButtonPressed
          ]}
        >
          <Text style={styles.accountSignOutLabel}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}
