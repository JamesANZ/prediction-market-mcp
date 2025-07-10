import {
  KalshiEvent,
  KalshiResponse,
  Market,
  MarketWithOdds,
  PredictItMarket,
  PredictItResponse,
} from "./types.js";
import superagent from "superagent";

const POLYMARKET_API_BASE = "https://clob.polymarket.com/markets";
const PREDICTIT_API_URL = "https://www.predictit.org/api/marketdata/all/";
const KALSHI_API_URL = "https://api.elections.kalshi.com/trade-api/v2/events";
const USER_AGENT = "prediction-markets/1.0";

export async function getPolymarketPredictionData(
  limit = 50,
  keyword = "",
): Promise<MarketWithOdds[]> {
  const res = await superagent
    .get(`${POLYMARKET_API_BASE}?limit=${limit}`)
    .set("User-Agent", USER_AGENT);

  const json = res.body;

  if (!Array.isArray(json.data)) {
    throw new Error("Unexpected API response format");
  }

  const lowerKeyword = keyword.toLowerCase();

  const currentMarkets = json.data.filter(
    (market: Market) =>
      market.active &&
      !market.archived &&
      (market.question?.toLowerCase().includes(lowerKeyword) ||
        market.description?.toLowerCase().includes(lowerKeyword) ||
        market.market_slug?.toLowerCase().includes(lowerKeyword)),
  );

  return currentMarkets.map((market: { tokens: any[] }) => {
    const totalPrice = market.tokens.reduce(
      (sum, token) => sum + token.price,
      0,
    );
    const odds: Record<string, number> = {};
    for (const token of market.tokens) {
      odds[token.outcome] = totalPrice > 0 ? token.price / totalPrice : 0;
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
