import { HttpGet, getJson } from "../http.js";
import { clipText, round4 } from "../text.js";
import { MarketWithOdds } from "../utils/types.js";
import { OutcomeQuote, TrackedMarket } from "./types.js";

const POLYMARKET_SEARCH_URL = "https://gamma-api.polymarket.com/public-search";
const POLYMARKET_MARKETS_URL = "https://gamma-api.polymarket.com/markets";
const POLYMARKET_HISTORY_URL = "https://clob.polymarket.com/prices-history";

type GammaMarket = {
  question?: string;
  description?: string;
  slug?: string;
  active?: boolean;
  closed?: boolean;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  events?: { slug?: string }[];
  [key: string]: unknown;
};

export async function getPolymarketPredictionData(
  limit = 50,
  keyword = "",
  http: HttpGet = getJson,
): Promise<MarketWithOdds[]> {
  const query = keyword || "politics";
  const json = (await http(
    `${POLYMARKET_SEARCH_URL}?q=${encodeURIComponent(query)}`,
  )) as { events?: { markets?: GammaMarket[] }[] };

  if (!json.events || !Array.isArray(json.events)) {
    throw new Error("Unexpected API response format");
  }

  const lowerKeyword = keyword.toLowerCase();
  const allMarkets: GammaMarket[] = [];
  for (const event of json.events) {
    if (event.markets && Array.isArray(event.markets)) {
      allMarkets.push(...event.markets);
    }
  }

  const currentMarkets = allMarkets
    .filter(
      (market) =>
        market.active &&
        !market.closed &&
        (market.question?.toLowerCase().includes(lowerKeyword) ||
          market.description?.toLowerCase().includes(lowerKeyword) ||
          market.slug?.toLowerCase().includes(lowerKeyword)),
    )
    .slice(0, limit);

  return currentMarkets.map((market) => {
    const odds: Record<string, number> = {};
    try {
      const outcomes: string[] = JSON.parse(market.outcomes || "[]");
      const outcomePrices: string[] = JSON.parse(market.outcomePrices || "[]");
      const prices = outcomePrices.map((price) => Number.parseFloat(price));
      const totalPrice = prices.reduce((sum, price) => sum + price, 0);
      if (totalPrice > 0) {
        for (let i = 0; i < outcomes.length && i < prices.length; i++) {
          odds[outcomes[i]] = prices[i] / totalPrice;
        }
      }
    } catch (error) {
      console.error("Error parsing market odds:", error);
    }
    return { ...market, odds } as MarketWithOdds;
  });
}

export async function getPolymarketMarket(
  idOrSlug: string,
  http: HttpGet = getJson,
): Promise<GammaMarket | null> {
  const query = /^\d+$/.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
  const body = await http(POLYMARKET_MARKETS_URL, query);
  const markets = Array.isArray(body) ? body : [];
  return (markets[0] as GammaMarket | undefined) ?? null;
}

export type PricePoint = { t: number; p: number };

export async function getPolymarketPriceHistory(
  tokenId: string,
  startTs: number,
  endTs: number,
  fidelity: number,
  http: HttpGet = getJson,
): Promise<PricePoint[]> {
  const body = (await http(POLYMARKET_HISTORY_URL, {
    market: tokenId,
    startTs,
    endTs,
    fidelity,
  })) as { history?: { t?: number; p?: number }[] };
  if (!Array.isArray(body.history)) {
    throw new Error("Unexpected Polymarket price history format");
  }
  return body.history
    .filter((point) => typeof point.t === "number" && typeof point.p === "number")
    .map((point) => ({ t: point.t as number, p: point.p as number }));
}

export function polymarketOutcomes(market: GammaMarket): OutcomeQuote[] {
  try {
    const names: string[] = JSON.parse(market.outcomes || "[]");
    const prices: string[] = JSON.parse(market.outcomePrices || "[]");
    const numeric = prices.map((price) => Number.parseFloat(price));
    const total = numeric.reduce((sum, price) => sum + (Number.isFinite(price) ? price : 0), 0);
    return names.map((name, index) => {
      const price = numeric[index];
      const probability =
        total > 0 && Number.isFinite(price) ? round4(price / total) : null;
      return { name, probability };
    });
  } catch {
    return [];
  }
}

export function polymarketTokenId(market: GammaMarket, outcome: string): string | undefined {
  let names: string[] = [];
  let tokens: string[] = [];
  try {
    names = JSON.parse(market.outcomes || "[]");
    tokens = JSON.parse(market.clobTokenIds || "[]");
  } catch {
    return undefined;
  }
  const index = names.findIndex((name) => name.toLowerCase() === outcome.toLowerCase());
  const token = tokens[index >= 0 ? index : 0];
  return token ? String(token) : undefined;
}

export function toTrackedPolymarket(
  market: GammaMarket,
  requestedOutcome?: string,
): TrackedMarket | { error: string } {
  const outcomes = polymarketOutcomes(market);
  if (outcomes.length === 0) return { error: "Polymarket market has no outcomes" };
  const outcome =
    (requestedOutcome
      ? outcomes.find((item) => item.name.toLowerCase() === requestedOutcome.toLowerCase())?.name
      : undefined) ??
    outcomes.find((item) => item.name.toLowerCase() === "yes")?.name ??
    outcomes[0].name;
  if (
    requestedOutcome &&
    !outcomes.some((item) => item.name.toLowerCase() === requestedOutcome.toLowerCase())
  ) {
    return { error: `Outcome "${requestedOutcome}" was not found on this Polymarket market` };
  }
  const slug = market.slug || "";
  const eventSlug = market.events?.[0]?.slug;
  const description = clipText(market.description || "", 400);
  return {
    platform: "polymarket",
    id: slug || String(market.id ?? ""),
    title: market.question || slug || "Polymarket market",
    url: `https://polymarket.com/event/${eventSlug || slug}`,
    descriptionExcerpt: description.text,
    outcomes,
    outcome,
    question: market.question || market.slug || "Polymarket market",
    polymarketTokenId: polymarketTokenId(market, outcome),
  };
}
