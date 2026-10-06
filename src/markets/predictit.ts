import { HttpGet, getJson } from "../http.js";
import { clipText, round4 } from "../text.js";
import { PredictItContract, PredictItMarket, PredictItResponse } from "../utils/types.js";
import { TrackedMarket } from "./types.js";

const PREDICTIT_API_URL = "https://www.predictit.org/api/marketdata/all/";

export async function getPredictItMarkets(
  http: HttpGet = getJson,
): Promise<PredictItMarket[]> {
  const data = (await http(PREDICTIT_API_URL)) as PredictItResponse;
  if (!Array.isArray(data.markets)) {
    throw new Error("Unexpected PredictIt API format");
  }
  return data.markets.filter((market) => market.status === "Open");
}

export function toTrackedPredictIt(
  market: PredictItMarket,
  contract: PredictItContract,
): TrackedMarket {
  const description = clipText("", 400);
  return {
    platform: "predictit",
    id: `${market.id}:${contract.id}`,
    title: `${market.name}: ${contract.shortName || contract.name}`,
    url: market.url || `https://www.predictit.org/markets/detail/${market.id}`,
    descriptionExcerpt: description.text,
    outcomes: market.contracts.map((item) => ({
      name: item.shortName || item.name,
      probability:
        typeof item.lastTradePrice === "number" ? round4(item.lastTradePrice) : null,
    })),
    outcome: contract.shortName || contract.name,
    question: market.name,
    predictItFrom:
      typeof contract.lastClosePrice === "number" ? contract.lastClosePrice : null,
    predictItTo:
      typeof contract.lastTradePrice === "number" ? contract.lastTradePrice : null,
  };
}
