import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getKalshiMarkets,
  getPolymarketPredictionData,
  getPredictItMarkets,
} from "./utils/utils.js";

const server = new McpServer({
  name: "prediction-markets",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  "get-prediction-markets",
  "Get prediction market prices from Polymarket, PredictIt, and Kalshi",
  {
    keyword: z
      .string()
      .max(50)
      .describe("Keyword for the market you're looking for (e.g. 'trump')"),
  },
  async ({ keyword }) => {
    const lowerKeyword = keyword.toLowerCase();

    const [polyMarkets, predictItMarkets, kalshiMarkets] = await Promise.all([
      getPolymarketPredictionData(50, keyword),
      getPredictItMarkets(),
      getKalshiMarkets(),
    ]);

    const filteredPredictIt = predictItMarkets.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerKeyword) ||
        m.shortName.toLowerCase().includes(lowerKeyword),
    );

    const filteredKalshi = kalshiMarkets.filter((e) =>
      e.title.toLowerCase().includes(lowerKeyword),
    );

    if (
      polyMarkets.length === 0 &&
      filteredPredictIt.length === 0 &&
      filteredKalshi.length === 0
    ) {
      return {
        content: [
          {
            type: "text",
            text: `No prediction markets found for keyword: "${keyword}"`,
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

    const predictItText = filteredPredictIt
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

    const kalshiText = filteredKalshi
      .map((e) => `**Kalshi: ${e.title}**\n${e.sub_title} (${e.category})`)
      .join("\n\n");

    const text = [polyText, predictItText, kalshiText]
      .filter(Boolean)
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
