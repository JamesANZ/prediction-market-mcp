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
    const errors: string[] = [];

    // Try each API separately with error handling
    let polyMarkets: any[] = [];
    let predictItMarkets: any[] = [];
    let kalshiMarkets: any[] = [];

    try {
      polyMarkets = await getPolymarketPredictionData(50, keyword);
    } catch (error) {
      errors.push(`Polymarket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      predictItMarkets = await getPredictItMarkets();
    } catch (error) {
      errors.push(`PredictIt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      kalshiMarkets = await getKalshiMarkets();
    } catch (error) {
      errors.push(`Kalshi: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const filteredPredictIt = predictItMarkets.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerKeyword) ||
        m.shortName.toLowerCase().includes(lowerKeyword),
    );

    const filteredKalshi = kalshiMarkets.filter((e) =>
      e.title.toLowerCase().includes(lowerKeyword),
    );

    // If all APIs failed
    if (errors.length === 3) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch prediction markets from all platforms:\n${errors.join('\n')}\n\nPlease try again later or check your internet connection.`,
          },
        ],
      };
    }

    // If no markets found but some APIs succeeded
    if (
      polyMarkets.length === 0 &&
      filteredPredictIt.length === 0 &&
      filteredKalshi.length === 0
    ) {
      const errorText = errors.length > 0 ? `⚠️ Some platforms failed: ${errors.join('; ')}\n\n` : '';
      return {
        content: [
          {
            type: "text",
            text: `${errorText}No prediction markets found for keyword: "${keyword}"`,
          },
        ],
      };
    }

    const polyText = polyMarkets
      .map((m: any) => {
        const oddsList = Object.entries(m.odds)
          .map(([outcome, prob]: [string, any]) => `${outcome}: ${(prob * 100).toFixed(1)}%`)
          .join(" | ");
        return `**Polymarket: ${m.question}**\n${oddsList}`;
      })
      .join("\n\n");

    const predictItText = filteredPredictIt
      .map((m: any) => {
        const contractOdds = m.contracts
          .map((c: any) => {
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

    const errorText = errors.length > 0 ? `⚠️ Some platforms failed: ${errors.join('; ')}\n\n` : '';

    return {
      content: [
        {
          type: "text",
          text: errorText + text,
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
