import { HttpGet } from "../http.js";
import { round4 } from "../text.js";
import { getKalshiCandles } from "./kalshi.js";
import { getPolymarketPriceHistory } from "./polymarket.js";
import { LOOKBACK_SECONDS, Lookback, TrackedMarket } from "./types.js";

export type Movement = {
  outcome: string;
  from: number;
  to: number;
  change: number;
  high: number;
  low: number;
  period: { lookback: Lookback; start: string; end: string };
  basis: "trade_history" | "previous_close";
  observations: number;
};

export function windowFor(lookback: Lookback, now: Date): { start: Date; end: Date } {
  const end = now;
  const start = new Date(now.getTime() - LOOKBACK_SECONDS[lookback] * 1000);
  return { start, end };
}

function fidelity(lookback: Lookback): number {
  switch (lookback) {
    case "1h":
      return 1;
    case "6h":
      return 5;
    case "24h":
      return 15;
    case "7d":
    case "30d":
      return 60;
  }
}

function dollars(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function summarize(
  market: TrackedMarket,
  lookback: Lookback,
  start: Date,
  end: Date,
  points: number[],
  basis: Movement["basis"],
): Movement | null {
  if (points.length === 0) return null;
  const from = points[0];
  const to = points[points.length - 1];
  return {
    outcome: market.outcome,
    from: round4(from),
    to: round4(to),
    change: round4(to - from),
    high: round4(Math.max(...points)),
    low: round4(Math.min(...points)),
    period: { lookback, start: start.toISOString(), end: end.toISOString() },
    basis,
    observations: points.length,
  };
}

export async function computeMovement(
  market: TrackedMarket,
  lookback: Lookback,
  now: Date,
  http: HttpGet,
): Promise<{ movement: Movement | null; warning?: string }> {
  const { start, end } = windowFor(lookback, now);
  try {
    if (market.platform === "polymarket") {
      if (!market.polymarketTokenId) {
        return { movement: null, warning: "Polymarket token id was missing, so price history could not be loaded." };
      }
      const history = await getPolymarketPriceHistory(
        market.polymarketTokenId,
        Math.floor(start.getTime() / 1000),
        Math.floor(end.getTime() / 1000),
        fidelity(lookback),
        http,
      );
      const points = history
        .filter((point) => point.t >= Math.floor(start.getTime() / 1000) && point.t <= Math.floor(end.getTime() / 1000))
        .sort((a, b) => a.t - b.t)
        .map((point) => point.p);
      const movement = summarize(market, lookback, start, end, points, "trade_history");
      if (!movement) {
        return { movement: null, warning: "No Polymarket trades were found in the lookback window." };
      }
      return { movement };
    }

    if (market.platform === "kalshi") {
      if (!market.kalshiSeriesTicker || !market.kalshiTicker) {
        return { movement: null, warning: "Kalshi series ticker was missing, so candlesticks could not be loaded." };
      }
      const period = lookback === "30d" ? 1440 : 60;
      const candles = await getKalshiCandles(
        market.kalshiSeriesTicker,
        market.kalshiTicker,
        Math.floor(start.getTime() / 1000),
        Math.floor(end.getTime() / 1000),
        period,
        http,
      );
      const ordered = [...candles].sort((a, b) => (a.end_period_ts ?? 0) - (b.end_period_ts ?? 0));
      const prices: number[] = [];
      for (const candle of ordered) {
        const open = dollars(candle.price?.open_dollars) ?? dollars(candle.price?.previous_dollars);
        const close = dollars(candle.price?.close_dollars) ?? open;
        if (prices.length === 0 && open != null) prices.push(open);
        if (close != null) prices.push(close);
      }
      const movement = summarize(market, lookback, start, end, prices, "trade_history");
      if (!movement) {
        return { movement: null, warning: "No Kalshi trades were found in the lookback window." };
      }
      const high = ordered
        .map((candle) => dollars(candle.price?.high_dollars))
        .filter((value): value is number => value != null);
      const low = ordered
        .map((candle) => dollars(candle.price?.low_dollars))
        .filter((value): value is number => value != null);
      if (high.length > 0) movement.high = round4(Math.max(movement.high, ...high));
      if (low.length > 0) movement.low = round4(Math.min(movement.low, ...low));
      return { movement };
    }

    const from = market.predictItFrom;
    const to = market.predictItTo;
    if (from == null || to == null || from === 0) {
      return {
        movement: null,
        warning: "PredictIt has no price history API, and this contract has no previous close.",
      };
    }
    const movement = summarize(market, lookback, start, end, [from, to], "previous_close");
    return {
      movement,
      warning:
        "PredictIt has no price history API. from/to compare the previous close with the last trade, not the requested lookback.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { movement: null, warning: `Price history could not be loaded: ${message}` };
  }
}
