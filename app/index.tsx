import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getLastFeedMetadata,
  listArticles,
  listCategories,
  type NewsArticle,
  type ArticleVariantKey
} from "../services/articles";
import { createRequestId, trackEvent } from "../services/analytics";
import {
  assignArticleVariantsForFeed,
  getOrCreateAssignmentUnitId
} from "../services/experiment";
import { useAuth } from "../state/auth";
import { useExperimentAssignment } from "../state/experimentAssignment";
import { useUserIdentity } from "../state/userIdentity";
import { styles } from "../styles/news";
import { formatMinutes } from "../utils/time";

function variantDisplayLabel(variantKey: ArticleVariantKey) {
  return variantKey === "clickbait" ? "Clickbait" : "Neutral";
}

function normalizeCardText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function groupArticlesByCategory(items: NewsArticle[]) {
  const groups = new Map<string, NewsArticle[]>();
  for (const article of items) {
    const key =
      typeof article.category === "string" && article.category.length > 0
        ? article.category
        : "General";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(article);
  }
  return Array.from(groups.entries()).map(([category, sectionArticles]) => ({
    category,
    articles: sectionArticles
  }));
}

export default function FeedRoute() {
  const insets = useSafeAreaInsets();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { userId, setUserId, availableUserIds, devUserSwitchEnabled } =
    useUserIdentity();
  const {
    arm,
    source: experimentSource,
    experimentKey,
    isLoading: assignmentLoading,
    resolvedUserId
  } = useExperimentAssignment();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [categories, setCategories] = useState<string[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [articleVariantAssignments, setArticleVariantAssignments] = useState<
    Record<string, ArticleVariantKey>
  >({});
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const articlePositionById = useMemo(() => {
    const map = new Map<string, number>();
    articles.forEach((article, index) => {
      map.set(article.id, index + 1);
    });
    return map;
  }, [articles]);
  const groupedArticles = useMemo(
    () => groupArticlesByCategory(articles),
    [articles]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadFeed() {
      if (authLoading || !isAuthenticated) {
        return;
      }
      if (assignmentLoading || resolvedUserId !== userId) {
        return;
      }
      const requestId = createRequestId();
      try {
        setIsLoading(true);
        setError(null);
        setCurrentRequestId(requestId);

        trackEvent({
          eventType: "feed_request",
          userId,
          surface: "home_feed",
          requestId,
          properties: {
            category: selectedCategory,
            source: "feed_screen_load",
            experimentKey,
            experimentArm: arm,
            experimentSource
          }
        });

        const [nextCategories, nextArticles] = await Promise.all([
          listCategories(),
          listArticles({ category: selectedCategory })
        ]);
        const feedMetadata = getLastFeedMetadata();
        const assignmentUnitId = await getOrCreateAssignmentUnitId();
        const assignments = assignArticleVariantsForFeed(
          arm,
          assignmentUnitId,
          nextArticles.map((article) => article.id),
          experimentKey
        ) as Record<string, ArticleVariantKey>;

        if (cancelled) {
          return;
        }

        setCategories(nextCategories);
        setArticles(nextArticles);
        setArticleVariantAssignments(assignments);

        trackEvent({
          eventType: "feed_response",
          userId,
          surface: "home_feed",
          requestId,
          properties: {
            category: selectedCategory,
            resultCount: nextArticles.length,
            orderedArticleIds: nextArticles.map((article) => article.id),
            rankScores: null,
            snapshotId: feedMetadata.snapshotId,
            snapshotDate: feedMetadata.snapshotDate,
            provider: feedMetadata.provider,
            cached: feedMetadata.cached,
            sourceUri: feedMetadata.sourceUri,
            experimentKey,
            experimentArm: arm,
            experimentSource
          }
        });

        nextArticles.forEach((article, index) => {
          const assignedVariantKey = assignments[article.id] ?? "facts_only";
          trackEvent({
            eventType: "impression",
            userId,
            surface: "home_feed",
            requestId,
            articleId: article.id,
            variantKey: assignedVariantKey,
            position: index + 1,
            properties: {
              category: selectedCategory,
              snapshotId: feedMetadata.snapshotId,
              snapshotDate: feedMetadata.snapshotDate,
              experimentKey,
              experimentArm: arm,
              experimentSource
            }
          });
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load feed.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFeed();
    return () => {
      cancelled = true;
    };
  }, [
    arm,
    experimentKey,
    experimentSource,
    selectedCategory,
    userId,
    assignmentLoading,
    resolvedUserId,
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.feedContent,
        { paddingTop: Math.max(8, insets.top + 6) }
      ]}
    >
      <View style={styles.masthead}>
        <View style={styles.mastheadSide} />
        <Text style={styles.mastheadBrand}>TailorMadeTimes</Text>
        <Pressable
          onPress={() => {
            router.push("/account");
          }}
          style={({ pressed }) => [
            styles.mastheadAccountButton,
            { opacity: pressed ? 0.85 : 1 }
          ]}
        >
          <Text style={styles.mastheadAccountLabel}>My Account</Text>
        </Pressable>
      </View>

      {devUserSwitchEnabled ? (
        <View style={styles.devUserSection}>
          <Text style={styles.devUserTitle}>
            Test User: {userId} | Experiment {experimentKey}: {arm} ({experimentSource})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {availableUserIds.map((candidateId) => {
              const active = candidateId === userId;
              return (
                <Pressable
                  key={candidateId}
                  onPress={() => setUserId(candidateId)}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      active && styles.categoryChipTextActive
                    ]}
                  >
                    {candidateId}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {["All", ...categories].map((category) => {
          const active = category === selectedCategory;
          return (
            <Pressable
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  active && styles.categoryChipTextActive
                ]}
              >
                {category}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading articles...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.loadingCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!isLoading &&
        !error &&
        (selectedCategory === "All" ? groupedArticles : [{ category: "", articles }]).map(
          (section) => (
            <View
              key={`section-${section.category || "single"}`}
              style={styles.sectionBlock}
            >
              {section.category ? (
                <Text style={styles.sectionTitle}>{section.category}</Text>
              ) : null}
              <View style={styles.sectionArticles}>
                {section.articles.map((article) => {
                  const position = articlePositionById.get(article.id) ?? 1;
                  const index = position - 1;
                  const assignedVariantKey =
                    articleVariantAssignments[article.id] ?? "facts_only";
                  const activeVariant =
                    article.variants?.[assignedVariantKey] ??
                    article.variants?.regular ??
                    null;
                  const cardTitle = activeVariant?.title ?? article.title;
                  const cardLead = activeVariant?.lead ?? article.lead;
                  const normalizedLead = normalizeCardText(cardLead);
                  const displayLead = normalizedLead;

                  return (
                    <Pressable
                      key={article.id}
                      onPress={() => {
                        const feedMetadata = getLastFeedMetadata();
                        trackEvent({
                          eventType: "article_click",
                          userId,
                          surface: "home_feed",
                          requestId: currentRequestId ?? undefined,
                          articleId: article.id,
                          variantKey: assignedVariantKey,
                          position,
                          properties: {
                            category: selectedCategory,
                            snapshotId: feedMetadata.snapshotId,
                            snapshotDate: feedMetadata.snapshotDate,
                            experimentKey,
                            experimentArm: arm,
                            experimentSource
                          }
                        });
                        router.push({
                          pathname: "/article/[id]",
                          params: {
                            id: article.id,
                            requestId: currentRequestId ?? "",
                            position: String(position),
                            surface: "home_feed",
                            snapshotId: String(feedMetadata.snapshotId ?? ""),
                            snapshotDate: feedMetadata.snapshotDate ?? "",
                            variantKey: assignedVariantKey
                          }
                        });
                      }}
                      style={({ pressed }) => [
                        styles.articleCard,
                        pressed && styles.articleCardPressed,
                        index === 0 && styles.articleCardFeatured
                      ]}
                    >
                      <Image source={{ uri: article.image }} style={styles.articleImage} />
                      <View style={styles.articleCardBody}>
                        <View style={styles.metaRow}>
                          <Text style={styles.topicBadge}>{article.topicLabel}</Text>
                          <Text style={styles.metaText}>
                            {formatMinutes(article.publishedMinutesAgo)}
                          </Text>
                        </View>
                        <Text style={styles.articleTitle} numberOfLines={3}>
                          {cardTitle}
                        </Text>
                        {displayLead.length > 0 ? (
                          <View style={styles.articleLeadBlock}>
                            <Text style={styles.articleLeadLabel}>Lead</Text>
                            <Text style={styles.articleLead}>{displayLead}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.articleCategory}>{article.category}</Text>
                        <Text style={styles.articleVariantTag}>
                          Assigned version: {variantDisplayLabel(assignedVariantKey)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )
        )}
    </ScrollView>
  );
}
