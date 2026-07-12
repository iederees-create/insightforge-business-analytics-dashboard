import type { MappedRow } from "../../types/domain";

export type SentimentLabel = "positive" | "neutral" | "negative";

// A compact, transparent lexicon — intentionally simple so the method stays explainable
// in-browser without an external AI API (Part 11: "be honest about methodology").
const POSITIVE_WORDS = new Set([
  "great", "love", "excellent", "amazing", "perfect", "fantastic", "wonderful", "happy",
  "best", "beautiful", "awesome", "recommend", "fast", "friendly", "quality", "comfortable",
  "impressed", "smooth", "easy", "helpful", "delighted", "satisfied", "exceeded", "superb",
]);
const NEGATIVE_WORDS = new Set([
  "bad", "terrible", "awful", "poor", "hate", "broken", "late", "disappointed", "worst",
  "rude", "slow", "cheap", "damaged", "refund", "wrong", "never", "waste", "horrible",
  "faulty", "misleading", "overpriced", "uncomfortable", "cancelled", "ignored",
]);
const NEGATIONS = new Set(["not", "no", "never", "n't", "without", "hardly"]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export interface SentimentScore {
  label: SentimentLabel;
  score: number; // -1..1
}

/**
 * Estimates sentiment via lexicon scoring with simple negation handling
 * (a word within 2 tokens after a negator flips its polarity). This is a
 * transparent estimate, not a trained model — the UI must label it as such.
 */
export function scoreSentiment(text: string): SentimentScore {
  const tokens = tokenize(text);
  let score = 0;
  let negateWindow = 0;

  for (const token of tokens) {
    if (NEGATIONS.has(token)) {
      negateWindow = 3;
      continue;
    }
    let wordScore = 0;
    if (POSITIVE_WORDS.has(token)) wordScore = 1;
    else if (NEGATIVE_WORDS.has(token)) wordScore = -1;

    if (wordScore !== 0 && negateWindow > 0) wordScore *= -1;
    score += wordScore;
    if (negateWindow > 0) negateWindow -= 1;
  }

  const normalized = tokens.length > 0 ? Math.max(-1, Math.min(1, score / Math.sqrt(tokens.length))) : 0;
  const label: SentimentLabel = normalized > 0.15 ? "positive" : normalized < -0.15 ? "negative" : "neutral";
  return { label, score: normalized };
}

export interface SentimentBreakdown {
  available: boolean;
  unavailableReason?: string;
  positiveShare: number;
  neutralShare: number;
  negativeShare: number;
  totalReviews: number;
  overTime: { date: Date; averageScore: number; count: number }[];
  topWords: { word: string; count: number }[];
  ratingVsSentiment: { rating: number; averageSentiment: number; count: number }[];
  examples: { sentiment: SentimentLabel; text: string }[];
}

const STOP_WORDS = new Set(["the", "and", "for", "with", "was", "this", "that", "have", "very", "but", "are", "not", "you", "your"]);

/** Aggregates review-level sentiment into the Review Sentiment and Topic Explorer view (Part 11). */
export function analyzeSentiment(rows: MappedRow[]): SentimentBreakdown {
  const reviews = rows.filter((r) => r.reviewText && r.reviewText.trim().length > 0);
  if (reviews.length === 0) {
    return {
      available: false,
      unavailableReason: "Map a Review text column to unlock sentiment analysis.",
      positiveShare: 0,
      neutralShare: 0,
      negativeShare: 0,
      totalReviews: 0,
      overTime: [],
      topWords: [],
      ratingVsSentiment: [],
      examples: [],
    };
  }

  const scored = reviews.map((row) => ({ row, ...scoreSentiment(row.reviewText as string) }));
  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const s of scored) counts[s.label] += 1;

  const wordCounts = new Map<string, number>();
  for (const s of scored) {
    for (const token of new Set(tokenize(s.row.reviewText as string))) {
      if (STOP_WORDS.has(token) || token.length < 4) continue;
      wordCounts.set(token, (wordCounts.get(token) ?? 0) + 1);
    }
  }
  const topWords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  const byDate = new Map<string, { total: number; count: number }>();
  for (const s of scored) {
    if (!s.row.date) continue;
    const key = s.row.date.toISOString().slice(0, 10);
    const entry = byDate.get(key) ?? { total: 0, count: 0 };
    entry.total += s.score;
    entry.count += 1;
    byDate.set(key, entry);
  }
  const overTime = [...byDate.entries()]
    .map(([key, { total, count }]) => ({ date: new Date(key), averageScore: total / count, count }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const byRating = new Map<number, { total: number; count: number }>();
  for (const s of scored) {
    if (s.row.rating === null) continue;
    const entry = byRating.get(s.row.rating) ?? { total: 0, count: 0 };
    entry.total += s.score;
    entry.count += 1;
    byRating.set(s.row.rating, entry);
  }
  const ratingVsSentiment = [...byRating.entries()]
    .map(([rating, { total, count }]) => ({ rating, averageSentiment: total / count, count }))
    .sort((a, b) => a.rating - b.rating);

  const examples: SentimentBreakdown["examples"] = (["positive", "neutral", "negative"] as SentimentLabel[]).flatMap((label) =>
    scored
      .filter((s) => s.label === label)
      .slice(0, 2)
      .map((s) => ({ sentiment: label, text: s.row.reviewText as string })),
  );

  return {
    available: true,
    positiveShare: counts.positive / reviews.length,
    neutralShare: counts.neutral / reviews.length,
    negativeShare: counts.negative / reviews.length,
    totalReviews: reviews.length,
    overTime,
    topWords,
    ratingVsSentiment,
    examples,
  };
}
