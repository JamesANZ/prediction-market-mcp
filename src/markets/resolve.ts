import { HttpGet } from "../http.js";
import { round4 } from "../text.js";
import { getKalshiEventsWithMarkets, getKalshiMarketByTicker, toTrackedKalshi } from "./kalshi.js";
import { getPolymarketMarket, getPolymarketPredictionData, toTrackedPolymarket } from "./polymarket.js";
import { getPredictItMarkets, toTrackedPredictIt } from "./predictit.js";
import { MarketCandidate, Resolution, TrackedMarket } from "./types.js";

const CANDIDATE_LIMIT = 5;

function directReference(market: string): { platform: "polymarket" | "kalshi" | "predictit"; id: string } | null {
  const match = /^(polymarket|kalshi|predictit):(\S+)$/i.exec(market.trim());
  if (!match) return null;
  return {
    platform: match[1].toLowerCase() as "polymarket" | "kalshi" | "predictit",
    id: match[2],
  };
}

function candidate(market: TrackedMarket): MarketCandidate {
  const quote = market.outcomes.find((item) => item.name.toLowerCase() === market.outcome.toLowerCase());
  return {
    platform: market.platform,
    id: market.id,
    title: market.title,
    probability: quote?.probability ?? null,
  };
}

export async function resolveMarket(
  input: string,
  outcome: string | undefined,
  http: HttpGet,
): Promise<Resolution> {
  const direct = directReference(input);
  if (direct) return resolveDirect(direct.platform, direct.id, outcome, http);
  return resolveKeyword(input.trim(), outcome, http);
}

async function resolveDirect(
  platform: "polymarket" | "kalshi" | "predictit",
  id: string,
  outcome: string | undefined,
  http: HttpGet,
): Promise<Resolution> {
  try {
    if (platform === "polymarket") {
      const market = await getPolymarketMarket(id, http);
      if (!market) return { status: "not_found", warnings: [`No Polymarket market found for "${id}".`] };
      const tracked = toTrackedPolymarket(market, outcome);
      if ("error" in tracked) return { status: "not_found", warnings: [tracked.error] };
      return { status: "found", market: tracked, warnings: [] };
    }
    if (platform === "kalshi") {
      const found = await getKalshiMarketByTicker(id, http);
      if (!found) return { status: "not_found", warnings: [`No Kalshi market found for "${id}".`] };
      const tracked = toTrackedKalshi(found.eventTitle, found.seriesTicker, found.market, outcome);
      if ("error" in tracked) return { status: "not_found", warnings: [tracked.error] };
      return { status: "found", market: tracked, warnings: [] };
    }
    const [marketId, contractId] = id.split(":");
    const markets = await getPredictItMarkets(http);
    const market = markets.find((item) => String(item.id) === marketId);
    if (!market) return { status: "not_found", warnings: [`No PredictIt market found for "${id}".`] };
    const contracts = contractId
      ? market.contracts.filter((contract) => String(contract.id) === contractId)
      : outcome
        ? market.contracts.filter((contract) => {
            const name = `${contract.name} ${contract.shortName}`.toLowerCase();
            return name.includes(outcome.toLowerCase());
          })
        : market.contracts;
    if (contracts.length === 1) {
      return { status: "found", market: toTrackedPredictIt(market, contracts[0]), warnings: [] };
    }
    if (contracts.length === 0) {
      return { status: "not_found", warnings: [`No PredictIt contract matched "${id}".`] };
    }
    const tracked = contracts.map((contract) => toTrackedPredictIt(market, contract));
    return ambiguous(tracked, []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { status: "not_found", warnings: [`${platform}: ${message}`] };
  }
}

async function resolveKeyword(
  keyword: string,
  outcome: string | undefined,
  http: HttpGet,
): Promise<Resolution> {
  const warnings: string[] = [];
  const matches: TrackedMarket[] = [];

  const [poly, predict, kalshi] = await Promise.allSettled([
    getPolymarketPredictionData(20, keyword, http),
    getPredictItMarkets(http),
    getKalshiEventsWithMarkets(keyword, http),
  ]);

  if (poly.status === "fulfilled") {
    for (const market of poly.value) {
      const tracked = toTrackedPolymarket(market, outcome);
      if (!("error" in tracked)) matches.push(tracked);
    }
  } else {
    warnings.push(`Polymarket: ${errorMessage(poly.reason)}`);
  }

  if (predict.status === "fulfilled") {
    const lower = keyword.toLowerCase();
    for (const market of predict.value) {
      const nameMatches =
        market.name.toLowerCase().includes(lower) || market.shortName.toLowerCase().includes(lower);
      if (!nameMatches) continue;
      const contracts = outcome
        ? market.contracts.filter((contract) =>
            `${contract.name} ${contract.shortName}`.toLowerCase().includes(outcome.toLowerCase()),
          )
        : market.contracts;
      const chosen = contracts.length > 0 ? contracts : outcome ? [] : market.contracts;
      for (const contract of chosen) matches.push(toTrackedPredictIt(market, contract));
    }
  } else {
    warnings.push(`PredictIt: ${errorMessage(predict.reason)}`);
  }

  if (kalshi.status === "fulfilled") {
    for (const event of kalshi.value) {
      for (const market of event.markets ?? []) {
        const tracked = toTrackedKalshi(event.title, event.series_ticker, market, outcome);
        if (!("error" in tracked)) matches.push(tracked);
      }
    }
  } else {
    warnings.push(`Kalshi: ${errorMessage(kalshi.reason)}`);
  }

  if (matches.length === 1) return { status: "found", market: matches[0], warnings };
  if (matches.length === 0) {
    return {
      status: "not_found",
      warnings: [`No prediction market matched "${keyword}".`, ...warnings],
    };
  }
  return ambiguous(matches, warnings);
}

function ambiguous(matches: TrackedMarket[], warnings: string[]): Resolution {
  const candidates = matches.slice(0, CANDIDATE_LIMIT).map(candidate);
  return {
    status: "ambiguous",
    candidates,
    matchCount: matches.length,
    warnings: [
      `Found ${matches.length} matching markets. Showing ${candidates.length}. Call again with platform:id, for example polymarket:<slug>, kalshi:<ticker>, or predictit:<marketId>:<contractId>.`,
      ...warnings,
    ],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function publicMarket(market: TrackedMarket) {
  return {
    platform: market.platform,
    id: market.id,
    title: market.title,
    url: market.url,
    descriptionExcerpt: market.descriptionExcerpt,
    outcomes: market.outcomes.map((outcome) => ({
      name: outcome.name,
      probability: outcome.probability == null ? null : round4(outcome.probability),
    })),
  };
}
