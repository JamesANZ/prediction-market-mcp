import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import superagent from "superagent";

const POLYMARKET_API_BASE = "https://clob.polymarket.com/markets";
const USER_AGENT = "prediction-markets/1.0";

const server = new McpServer({
  name: "prediction-markets",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

const PREDICTIT_API_URL = "https://www.predictit.org/api/marketdata/all/";

type PredictItContract = {
  id: number;
  name: string;
  shortName: string;
  status: string;
  lastTradePrice: number;
  bestBuyYesCost: number | null;
  bestBuyNoCost: number | null;
  bestSellYesCost: number | null;
  bestSellNoCost: number | null;
  lastClosePrice: number;
};

type PredictItMarket = {
  id: number;
  name: string;
  shortName: string;
  image: string;
  url: string;
  contracts: PredictItContract[];
  timeStamp: string;
  status: string;
};

type PredictItResponse = {
  markets: PredictItMarket[];
};

async function getPredictItMarkets(): Promise<PredictItMarket[]> {
  const res = await superagent
    .get(PREDICTIT_API_URL)
    .set("User-Agent", USER_AGENT);

  const data: PredictItResponse = res.body;

  if (!Array.isArray(data.markets)) {
    throw new Error("Unexpected PredictIt API format");
  }

  return data.markets.filter((market) => market.status === "Open");
}

type Token = {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
};

type Market = {
  question: string;
  active: boolean;
  archived: boolean;
  market_slug: string;
  description?: string;
  tokens: Token[];
  [key: string]: any;
};

type MarketWithOdds = Market & {
  odds: Record<string, number>;
};

async function getPolymarketPredictionData(
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

server.tool(
  "get-prediction-markets",
  "Get prediction market prices from Polymarket and PredictIt",
  {
    keyword: z
      .string()
      .max(50)
      .describe("Keyword for the market you're looking for (e.g. 'trump')"),
  },
  async ({ keyword }) => {
    const [polyMarkets, predictItMarkets] = await Promise.all([
      getPolymarketPredictionData(50, keyword),
      getPredictItMarkets(),
    ]);

    const lowerKeyword = keyword.toLowerCase();

    const filteredPredictItMarkets = predictItMarkets.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerKeyword) ||
        m.shortName.toLowerCase().includes(lowerKeyword),
    );

    if (polyMarkets.length === 0 && filteredPredictItMarkets.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No current prediction markets found for keyword: "${keyword}"`,
          },
        ],
      };
    }

    const polyText = polyMarkets
      .map((m) => {
        const oddsList = Object.entries(m.odds)
          .map(([outcome, prob]) => `${outcome}: ${(prob * 100).toFixed(1)}%`)
          .join(" | ");
        return `**Polymarket: ${m.question}**\n${oddsList}`;
      })
      .join("\n\n");

    const predictItText = filteredPredictItMarkets
      .map((m) => {
        const contractOdds = m.contracts
          .map((c) => {
            const pct =
              c.lastTradePrice != null
                ? `${(c.lastTradePrice * 100).toFixed(1)}%`
                : "n/a";
            return `${c.shortName}: ${pct}`;
          })
          .join(" | ");
        return `**PredictIt: ${m.name}**\n${contractOdds}`;
      })
      .join("\n\n");

    const text = [polyText, predictItText].filter(Boolean).join("\n\n");

    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Prediction market MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
