import {
  KalshiEvent,
  KalshiEventWithMarkets,
  KalshiMarket,
  KalshiMarketsResponse,
  KalshiResponse,
  Market,
  MarketWithOdds,
  PredictItMarket,
  PredictItResponse,
} from "./types.js";
import superagent from "superagent";

const POLYMARKET_API_BASE = "https://gamma-api.polymarket.com/public-search";
const PREDICTIT_API_URL = "https://www.predictit.org/api/marketdata/all/";
const KALSHI_API_URL = "https://api.elections.kalshi.com/trade-api/v2/events";
const KALSHI_MARKETS_API_URL =
  "https://api.elections.kalshi.com/trade-api/v2/markets";
const USER_AGENT = "prediction-markets/1.0";

export async function getPolymarketPredictionData(
  limit = 50,
  keyword = "",
): Promise<MarketWithOdds[]> {
  // The new API requires a query parameter 'q', use keyword if provided
  const query = keyword || "politics";

  const res = await superagent
    .get(`${POLYMARKET_API_BASE}?q=${encodeURIComponent(query)}`)
    .set("User-Agent", USER_AGENT);

  const json = res.body;

  if (!json.events || !Array.isArray(json.events)) {
    throw new Error("Unexpected API response format");
  }

  const lowerKeyword = keyword.toLowerCase();

  // Flatten events to get all markets
  const allMarkets: any[] = [];
  for (const event of json.events) {
    if (event.markets && Array.isArray(event.markets)) {
      allMarkets.push(...event.markets);
    }
  }

  // Filter markets by keyword and active status
  const currentMarkets = allMarkets
    .filter(
      (market: any) =>
        market.active &&
        !market.closed &&
        (market.question?.toLowerCase().includes(lowerKeyword) ||
          market.description?.toLowerCase().includes(lowerKeyword) ||
          market.slug?.toLowerCase().includes(lowerKeyword)),
    )
    .slice(0, limit);

  // Convert markets to MarketWithOdds format
  return currentMarkets.map((market: any) => {
    const odds: Record<string, number> = {};

    // Parse outcomes and outcomePrices JSON strings
    try {
      const outcomes: string[] = JSON.parse(market.outcomes || "[]");
      const outcomePrices: string[] = JSON.parse(market.outcomePrices || "[]");

      // Calculate probabilities from prices
      const prices = outcomePrices.map((p) => parseFloat(p));
      const totalPrice = prices.reduce((sum, price) => sum + price, 0);

      if (totalPrice > 0) {
        for (let i = 0; i < outcomes.length && i < prices.length; i++) {
          odds[outcomes[i]] = prices[i] / totalPrice;
        }
      }
    } catch (error) {
      // If parsing fails, odds will remain empty
      console.error("Error parsing market odds:", error);
    }

    return { ...market, odds };
  });
}

export async function getPredictItMarkets(): Promise<PredictItMarket[]> {
  const res = await superagent
    .get(PREDICTIT_API_URL)
    .set("User-Agent", USER_AGENT);

  const data: PredictItResponse = res.body;

  if (!Array.isArray(data.markets)) {
    throw new Error("Unexpected PredictIt API format");
  }

  return data.markets.filter((market) => market.status === "Open");
}

export async function getKalshiMarkets(): Promise<KalshiEvent[]> {
  const res = await superagent
    .get(KALSHI_API_URL)
    .set("accept", "application/json")
    .set("User-Agent", USER_AGENT);

  const data: KalshiResponse = res.body;

  if (!Array.isArray(data.events)) {
    throw new Error("Unexpected Kalshi API format");
  }

  return data.events;
}

export async function getKalshiMarketData(
  eventTicker: string,
): Promise<KalshiMarket[]> {
  try {
    const res = await superagent
      .get(KALSHI_MARKETS_API_URL)
      .query({ event_ticker: eventTicker })
      .set("accept", "application/json")
      .set("User-Agent", USER_AGENT);

    const data: KalshiMarketsResponse = res.body;

    if (!Array.isArray(data.markets)) {
      return [];
    }

    // Filter to markets that are open/active or have pricing data
    // Exclude closed, cancelled, and finalized markets without recent activity
    return data.markets.filter((market) => {
      const status = market.status?.toLowerCase();
      const hasPricing =
        parseFloat(market.yes_ask_dollars || "0") > 0 ||
        parseFloat(market.yes_bid_dollars || "0") > 0 ||
        parseFloat(market.last_price_dollars || "0") > 0;

      // Include if status is open/active/live, or if it has pricing data and isn't explicitly closed
      return (
        status === "open" ||
        status === "active" ||
        status === "live" ||
        (hasPricing && status !== "closed" && status !== "cancelled")
      );
    });
  } catch (error) {
    // If market data fetch fails, return empty array
    return [];
  }
}

export async function getKalshiEventsWithMarkets(
  keyword: string = "",
): Promise<KalshiEventWithMarkets[]> {
  const events = await getKalshiMarkets();
  const lowerKeyword = keyword.toLowerCase();

  // Filter events by keyword
  const filteredEvents = events.filter(
    (e) =>
      e.title.toLowerCase().includes(lowerKeyword) ||
      e.sub_title.toLowerCase().includes(lowerKeyword) ||
      e.category.toLowerCase().includes(lowerKeyword),
  );

  // Fetch market data for filtered events (limit to first 20 to avoid too many API calls)
  const eventsWithMarkets: KalshiEventWithMarkets[] = await Promise.all(
    filteredEvents.slice(0, 20).map(async (event) => {
      const markets = await getKalshiMarketData(event.event_ticker);
      return {
        ...event,
        markets: markets.length > 0 ? markets : undefined,
      };
    }),
  );

  // Only return events that have active markets
  return eventsWithMarkets.filter((e) => e.markets && e.markets.length > 0);
}
