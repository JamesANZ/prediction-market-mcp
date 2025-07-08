import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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
  const res = await fetch(`${POLYMARKET_API_BASE}?limit=${limit}`, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });
  const json = await res.json();

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
  "Get prediction market prices",
  {
    keyword: z
      .string()
      .max(50)
      .describe("Keyword for the market you're looking for (e.g. 'trump')"),
  },
  async ({ keyword }) => {
    const markets = await getPolymarketPredictionData(50, keyword);

    if (!markets.length) {
      return {
        content: [
          {
            type: "text",
            text: `No current prediction markets found for keyword: "${keyword}"`,
          },
        ],
      };
    }

    const text = markets
      .map((m) => {
        const oddsList = Object.entries(m.odds)
          .map(([outcome, prob]) => `${outcome}: ${(prob * 100).toFixed(1)}%`)
          .join(" | ");
        return `**${m.question}**\n${oddsList}`;
      })
      .join("\n\n");

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
