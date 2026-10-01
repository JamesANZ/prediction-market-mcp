export type Platform = "polymarket" | "predictit" | "kalshi";

export type Lookback = "1h" | "6h" | "24h" | "7d" | "30d";

export type OutcomeQuote = {
  name: string;
  probability: number | null;
};

export type MarketCandidate = {
  platform: Platform;
  id: string;
  title: string;
  probability: number | null;
};

export type TrackedMarket = {
  platform: Platform;
  id: string;
  title: string;
  url: string;
  descriptionExcerpt: string;
  outcomes: OutcomeQuote[];
  outcome: string;
  question: string;
  polymarketTokenId?: string;
  kalshiSeriesTicker?: string;
  kalshiTicker?: string;
  predictItFrom?: number | null;
  predictItTo?: number | null;
};

export type Resolution = {
  warnings: string[];
} & (
  | { status: "found"; market: TrackedMarket }
  | { status: "ambiguous"; candidates: MarketCandidate[]; matchCount: number }
  | { status: "not_found" }
);

export const LOOKBACK_SECONDS: Record<Lookback, number> = {
  "1h": 60 * 60,
  "6h": 6 * 60 * 60,
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
  "30d": 30 * 24 * 60 * 60,
};
