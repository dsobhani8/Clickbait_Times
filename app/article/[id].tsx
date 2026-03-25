import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
import {
  getArticleById,
  type ArticleVariantKey,
  type NewsArticle
} from "../../services/articles";
import { trackEvent } from "../../services/analytics";
import { useAuth } from "../../state/auth";
import { useExperimentAssignment } from "../../state/experimentAssignment";
import { useUserIdentity } from "../../state/userIdentity";
import { styles } from "../../styles/news";
import { formatMinutes } from "../../utils/time";

function resolveVariantKey(
  experimentArm: "neutral" | "clickbait"
): ArticleVariantKey {
  if (experimentArm === "neutral") {
    return "facts_only";
  }
  if (experimentArm === "clickbait") {
    return "clickbait";
  }

  return "regular";
}

function parseRouteVariantKey(value: string | undefined): ArticleVariantKey | null {
  if (value === "facts_only" || value === "clickbait" || value === "regular") {
    return value;
  }
  return null;
}

function variantLabel(key: ArticleVariantKey): string {
  switch (key) {
    case "facts_only":
      return "Facts Only";
    case "clickbait":
      return "Clickbait";
    default:
      return "Regular";
  }
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export default function ArticleRoute() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { userId } = useUserIdentity();
  const { arm, source: experimentSource, experimentKey } =
    useExperimentAssignment();
  const { id, requestId, position, surface, snapshotId, snapshotDate, variantKey } = useLocalSearchParams<{
    id: string;
    requestId?: string;
    position?: string;
    surface?: string;
    snapshotId?: string;
    snapshotDate?: string;
    variantKey?: string;
  }>();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const articleOpenTimeRef = useRef<number | null>(null);
  const currentVariantKeyRef = useRef<ArticleVariantKey>("regular");

  const activeVariantKey = parseRouteVariantKey(variantKey) ?? resolveVariantKey(arm);
  const activeVariant = article?.variants[activeVariantKey] ?? null;
  const variantBody = activeVariant?.body ?? article?.body ?? [];
  const variantLead = activeVariant?.lead ?? article?.lead ?? "";
  const firstParagraph = variantBody[0] ?? "";
  const normalizedLead = normalizeText(variantLead);
  const normalizedFirstParagraph = normalizeText(firstParagraph);
  const shouldShowLead =
    normalizedLead.length > 0 &&
    (!normalizedFirstParagraph ||
      !(
        normalizedLead === normalizedFirstParagraph ||
        normalizedFirstParagraph.startsWith(normalizedLead) ||
        normalizedLead.startsWith(normalizedFirstParagraph)
      ));
  const sourceArticleUri = article?.source?.articleUri ?? null;
  const numericSnapshotId =
    typeof snapshotId === "string" && Number.isFinite(Number(snapshotId))
      ? Number(snapshotId)
      : null;
  const resolvedSnapshotDate =
    typeof snapshotDate === "string" && snapshotDate.length > 0
      ? snapshotDate
      : null;

  useEffect(() => {
    currentVariantKeyRef.current = activeVariantKey;
  }, [activeVariantKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadArticle(articleId: string) {
      if (authLoading || !isAuthenticated) {
        return;
      }
      try {
        setIsLoading(true);
        setError(null);

        const nextArticle = await getArticleById(articleId, {
          snapshotId: numericSnapshotId,
          snapshotDate: resolvedSnapshotDate
        });

        if (cancelled) {
          return;
        }

        if (!nextArticle) {
          setError("Article not found.");
          setArticle(null);
          return;
        }

        setArticle(nextArticle);
        articleOpenTimeRef.current = Date.now();

        trackEvent({
          eventType: "article_open",
          userId,
          surface: "article",
          requestId:
            typeof requestId === "string" && requestId.length > 0
              ? requestId
              : undefined,
          articleId: nextArticle.id,
          variantKey: activeVariantKey,
          position:
            typeof position === "string" && Number.isFinite(Number(position))
              ? Number(position)
              : undefined,
          properties: {
            source: typeof surface === "string" ? surface : "direct",
            snapshotId: numericSnapshotId,
            snapshotDate: resolvedSnapshotDate,
            experimentKey,
            experimentArm: arm,
            experimentSource
          }
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load article.");
          setArticle(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (typeof id === "string" && id.length > 0) {
      loadArticle(id);
    } else if (authLoading || !isAuthenticated) {
      setIsLoading(false);
    } else {
      setError("Missing article id.");
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [
    id,
    numericSnapshotId,
    position,
    requestId,
    resolvedSnapshotDate,
    surface,
    arm,
    experimentKey,
    experimentSource,
    userId,
    authLoading,
    isAuthenticated
  ]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }
    if (!article) {
      return;
    }

    trackEvent({
      eventType: "variant_applied",
      userId,
      surface: "article",
      requestId:
        typeof requestId === "string" && requestId.length > 0
          ? requestId
          : undefined,
      articleId: article.id,
      variantKey: activeVariantKey,
      position:
        typeof position === "string" && Number.isFinite(Number(position))
          ? Number(position)
          : undefined,
      properties: {
        snapshotId: numericSnapshotId,
        snapshotDate: resolvedSnapshotDate,
        experimentKey,
        experimentArm: arm,
        experimentSource
      }
    });
  }, [
    activeVariantKey,
    arm,
    article,
    experimentKey,
    experimentSource,
    position,
    requestId,
    resolvedSnapshotDate,
    numericSnapshotId,
    userId,
    authLoading,
    isAuthenticated
  ]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }
    return () => {
      if (!article || !articleOpenTimeRef.current) {
        return;
      }

      const seconds = Math.max(
        0,
        Math.round((Date.now() - articleOpenTimeRef.current) / 1000)
      );

      trackEvent({
        eventType: "read_time",
        userId,
        surface: "article",
        requestId:
          typeof requestId === "string" && requestId.length > 0
            ? requestId
            : undefined,
        articleId: article.id,
        variantKey: currentVariantKeyRef.current,
        position:
          typeof position === "string" && Number.isFinite(Number(position))
            ? Number(position)
            : undefined,
        properties: {
          seconds,
          snapshotId: numericSnapshotId,
          snapshotDate: resolvedSnapshotDate,
          experimentKey,
          experimentArm: arm,
          experimentSource
        }
      });
    };
  }, [
    article,
    position,
    requestId,
    resolvedSnapshotDate,
    numericSnapshotId,
    arm,
    experimentKey,
    experimentSource,
    userId,
    authLoading,
    isAuthenticated
  ]);

  if (authLoading) {
    return (
      <View style={[styles.screen, { padding: 16 }]}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Checking session...</Text>
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (isLoading) {
    return (
      <View style={[styles.screen, { padding: 16 }]}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading article...</Text>
        </View>
      </View>
    );
  }

  if (error || !article) {
    return (
      <View style={[styles.screen, { padding: 16 }]}>
        <View style={styles.loadingCard}>
          <Text style={styles.errorText}>{error ?? "Article unavailable."}</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.readerContent}>
        <Image source={{ uri: article.image }} style={styles.readerHeroImage} />

        <View style={styles.readerHeader}>
          <View style={styles.metaRow}>
            <Text style={styles.topicBadge}>{article.topicLabel}</Text>
            <Text style={styles.metaText}>
              {formatMinutes(article.publishedMinutesAgo)}
            </Text>
          </View>
          <Text style={styles.readerTitle}>{activeVariant?.title ?? article.title}</Text>
          {shouldShowLead ? (
            <Text style={styles.readerLead}>{variantLead}</Text>
          ) : null}
          <Text style={styles.readerCategory}>{article.category}</Text>
          <Text style={styles.activeVariantTag}>
            Active version: {variantLabel(activeVariantKey)}
          </Text>
          {sourceArticleUri ? (
            <Pressable
              onPress={() => {
                Linking.openURL(sourceArticleUri).catch(() => {
                  // Ignore open failures in MVP.
                });
              }}
              style={({ pressed }) => [
                styles.sourceLinkButton,
                pressed && styles.sourceLinkButtonPressed
              ]}
            >
              <Text style={styles.sourceLinkButtonText}>Read full article</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.readerBody}>
          {variantBody.map((paragraph, index) => (
            <Text key={`${article.id}-${index}`} style={styles.readerParagraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      </ScrollView>
    </>
  );
}
