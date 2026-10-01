import { HttpGet, getJson } from "../http.js";
import { clipText, round4 } from "../text.js";
import {
  KalshiEvent,
  KalshiEventWithMarkets,
  KalshiMarket,
  KalshiMarketsResponse,
  KalshiResponse,
} from "../utils/types.js";
import { TrackedMarket } from "./types.js";

const KALSHI_API_URL = "https://api.elections.kalshi.com/trade-api/v2/events";
const KALSHI_MARKETS_API_URL = "https://api.elections.kalshi.com/trade-api/v2/markets";
const KALSHI_TRADE_API = "https://api.elections.kalshi.com/trade-api/v2";

export async function getKalshiMarkets(http: HttpGet = getJson): Promise<KalshiEvent[]> {
  const data = (await http(KALSHI_API_URL)) as KalshiResponse;
  if (!Array.isArray(data.events)) {
    throw new Error("Unexpected Kalshi API format");
  }
  return data.events;
}

export async function getKalshiMarketData(
  eventTicker: string,
  http: HttpGet = getJson,
): Promise<KalshiMarket[]> {
  try {
    const data = (await http(KALSHI_MARKETS_API_URL, {
      event_ticker: eventTicker,
    })) as KalshiMarketsResponse;
    if (!Array.isArray(data.markets)) return [];
    return data.markets.filter((market) => {
      const status = market.status?.toLowerCase();
      const hasPricing =
        Number.parseFloat(market.yes_ask_dollars || "0") > 0 ||
        Number.parseFloat(market.yes_bid_dollars || "0") > 0 ||
        Number.parseFloat(market.last_price_dollars || "0") > 0;
      return (
        status === "open" ||
        status === "active" ||
        status === "live" ||
        (hasPricing && status !== "closed" && status !== "cancelled")
      );
    });
  } catch {
    return [];
  }
}

export async function getKalshiEventsWithMarkets(
  keyword = "",
  http: HttpGet = getJson,
): Promise<KalshiEventWithMarkets[]> {
  const events = await getKalshiMarkets(http);
  const lowerKeyword = keyword.toLowerCase();
  const filteredEvents = events.filter(
    (event) =>
      event.title.toLowerCase().includes(lowerKeyword) ||
      event.sub_title.toLowerCase().includes(lowerKeyword) ||
      event.category.toLowerCase().includes(lowerKeyword),
  );
  const eventsWithMarkets: KalshiEventWithMarkets[] = await Promise.all(
    filteredEvents.slice(0, 20).map(async (event) => {
      const markets = await getKalshiMarketData(event.event_ticker, http);
      return {
        ...event,
        markets: markets.length > 0 ? markets : undefined,
      };
    }),
  );
  return eventsWithMarkets.filter((event) => event.markets && event.markets.length > 0);
}

export function kalshiYesProbability(market: KalshiMarket): number | null {
  const yesBid = Number.parseFloat(market.yes_bid_dollars || "0");
  const yesAsk = Number.parseFloat(market.yes_ask_dollars || "0");
  const lastPrice = Number.parseFloat(market.last_price_dollars || "0");
  if (yesBid > 0 && yesAsk > 0) return round4((yesBid + yesAsk) / 2);
  if (lastPrice > 0) return round4(lastPrice);
  if (yesBid > 0) return round4(yesBid);
  if (yesAsk > 0) return round4(yesAsk);
  return null;
}

export async function getKalshiMarketByTicker(
  ticker: string,
  http: HttpGet = getJson,
): Promise<{ market: KalshiMarket; seriesTicker: string; eventTitle: string } | null> {
  const marketBody = (await http(`${KALSHI_MARKETS_API_URL}/${encodeURIComponent(ticker)}`)) as {
    market?: KalshiMarket;
  };
  const market = marketBody.market;
  if (!market?.ticker || !market.event_ticker) return null;
  const eventBody = (await http(
    `${KALSHI_API_URL}/${encodeURIComponent(market.event_ticker)}`,
  )) as { event?: { series_ticker?: string; title?: string; sub_title?: string } };
  const event = eventBody.event;
  if (!event?.series_ticker) return null;
  return {
    market,
    seriesTicker: event.series_ticker,
    eventTitle: event.title || market.title || ticker,
  };
}

export type KalshiCandle = {
  end_period_ts?: number;
  price?: {
    open_dollars?: string | null;
    close_dollars?: string | null;
    high_dollars?: string | null;
    low_dollars?: string | null;
    previous_dollars?: string | null;
  };
};

export async function getKalshiCandles(
  seriesTicker: string,
  ticker: string,
  startTs: number,
  endTs: number,
  periodInterval: number,
  http: HttpGet = getJson,
): Promise<KalshiCandle[]> {
  const body = (await http(
    `${KALSHI_TRADE_API}/series/${encodeURIComponent(seriesTicker)}/markets/${encodeURIComponent(ticker)}/candlesticks`,
    { start_ts: startTs, end_ts: endTs, period_interval: periodInterval },
  )) as { candlesticks?: KalshiCandle[] };
  if (!Array.isArray(body.candlesticks)) {
    throw new Error("Unexpected Kalshi candlestick format");
  }
  return body.candlesticks;
}

export function toTrackedKalshi(
  eventTitle: string,
  seriesTicker: string,
  market: KalshiMarket,
  requestedOutcome?: string,
): TrackedMarket | { error: string } {
  const yesName = market.yes_sub_title || "Yes";
  const noName = market.no_sub_title || "No";
  const yes = kalshiYesProbability(market);
  const outcomes = [
    { name: yesName, probability: yes },
    { name: noName, probability: yes == null ? null : round4(1 - yes) },
  ];
  const wanted = requestedOutcome?.toLowerCase();
  if (
    wanted &&
    wanted !== "yes" &&
    wanted !== "no" &&
    wanted !== yesName.toLowerCase() &&
    wanted !== noName.toLowerCase()
  ) {
    return { error: `Outcome "${requestedOutcome}" was not found on this Kalshi market` };
  }
  const outcome =
    wanted === "no" || wanted === noName.toLowerCase() ? noName : yesName;
  const subtitle = market.subtitle || market.yes_sub_title || "";
  const description = clipText(subtitle, 400);
  return {
    platform: "kalshi",
    id: market.ticker,
    title: subtitle ? `${eventTitle}: ${subtitle}` : eventTitle || market.title,
    url: `https://kalshi.com/markets/${seriesTicker}/${market.event_ticker}`,
    descriptionExcerpt: description.text,
    outcomes,
    outcome,
    question: eventTitle || market.title,
    kalshiSeriesTicker: seriesTicker,
    kalshiTicker: market.ticker,
  };
}
