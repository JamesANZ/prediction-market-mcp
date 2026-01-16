import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getKalshiEventsWithMarkets,
  getPolymarketPredictionData,
  getPredictItMarkets,
} from "./utils/utils.js";
import { KalshiMarket } from "./utils/types.js";

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
      errors.push(
        `Polymarket: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    try {
      predictItMarkets = await getPredictItMarkets();
    } catch (error) {
      errors.push(
        `PredictIt: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    try {
      kalshiMarkets = await getKalshiEventsWithMarkets(keyword);
    } catch (error) {
      errors.push(
        `Kalshi: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    const filteredPredictIt = predictItMarkets.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerKeyword) ||
        m.shortName.toLowerCase().includes(lowerKeyword),
    );

    const filteredKalshi = kalshiMarkets;

    // If all APIs failed
    if (errors.length === 3) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch prediction markets from all platforms:\n${errors.join("\n")}\n\nPlease try again later or check your internet connection.`,
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
      const errorText =
        errors.length > 0
          ? `⚠️ Some platforms failed: ${errors.join("; ")}\n\n`
          : "";
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
          .map(
            ([outcome, prob]: [string, any]) =>
              `${outcome}: ${(prob * 100).toFixed(1)}%`,
          )
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
      .map((e) => {
        if (!e.markets || e.markets.length === 0) {
          return `**Kalshi: ${e.title}**\n${e.sub_title} (${e.category}) - No active markets`;
        }

        const marketTexts = e.markets.map((market: KalshiMarket) => {
          // Calculate probability from bid/ask midpoint, or use last price
          const yesBid = parseFloat(market.yes_bid_dollars || "0");
          const yesAsk = parseFloat(market.yes_ask_dollars || "0");
          const noBid = parseFloat(market.no_bid_dollars || "0");
          const noAsk = parseFloat(market.no_ask_dollars || "0");
          const lastPrice = parseFloat(market.last_price_dollars || "0");

          let yesProb = "n/a";
          let noProb = "n/a";

          // Calculate Yes probability
          if (yesBid > 0 || yesAsk > 0) {
            const yesMid =
              yesBid > 0 && yesAsk > 0
                ? (yesBid + yesAsk) / 2
                : lastPrice > 0
                  ? lastPrice
                  : yesBid > 0
                    ? yesBid
                    : yesAsk;
            yesProb = `${(yesMid * 100).toFixed(1)}%`;
          } else if (lastPrice > 0) {
            yesProb = `${(lastPrice * 100).toFixed(1)}%`;
          }

          // Calculate No probability (complement of Yes for binary markets)
          if (noBid > 0 || noAsk > 0) {
            const noMid =
              noBid > 0 && noAsk > 0
                ? (noBid + noAsk) / 2
                : 1 - lastPrice > 0 && lastPrice > 0
                  ? 1 - lastPrice
                  : noBid > 0
                    ? noBid
                    : noAsk;
            noProb = `${(noMid * 100).toFixed(1)}%`;
          } else if (lastPrice > 0) {
            noProb = `${((1 - lastPrice) * 100).toFixed(1)}%`;
          }

          const statusText =
            market.status &&
            market.status !== "open" &&
            market.status !== "active" &&
            market.status !== "live"
              ? ` [${market.status}]`
              : "";

          const marketSubtitle = market.subtitle || market.yes_sub_title || "";
          const subtitleText = marketSubtitle ? ` (${marketSubtitle})` : "";

          return `  ${market.yes_sub_title || "Yes"}: ${yesProb} | ${market.no_sub_title || "No"}: ${noProb}${subtitleText}${statusText}`;
        });

        const eventSubtitle = e.sub_title ? `\n${e.sub_title}` : "";
        return `**Kalshi: ${e.title}**${eventSubtitle} (${e.category})\n${marketTexts.join("\n")}`;
      })
      .join("\n\n");

    const text = [polyText, predictItText, kalshiText]
      .filter(Boolean)
      .join("\n\n");

    const errorText =
      errors.length > 0
        ? `⚠️ Some platforms failed: ${errors.join("; ")}\n\n`
        : "";

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
