import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpGet } from "../src/http.js";
import { computeMovement } from "../src/markets/movement.js";
import { getPolymarketPredictionData } from "../src/markets/polymarket.js";
import { resolveMarket } from "../src/markets/resolve.js";
import { TrackedMarket } from "../src/markets/types.js";
import { getPolymarketPredictionData as exportedSearch } from "../src/utils/utils.js";
import { NOW, polyMarket } from "./helpers.js";

const start = Math.floor(NOW.getTime() / 1000) - 24 * 60 * 60;

function trackedPoly(): TrackedMarket {
  return {
    platform: "polymarket",
    id: "fed-cut",
    title: "Will the Fed cut rates?",
    url: "https://polymarket.com/event/fed-event",
    descriptionExcerpt: "Resolution follows the official source.",
    outcomes: [
      { name: "Yes", probability: 0.55 },
      { name: "No", probability: 0.45 },
    ],
    outcome: "Yes",
    question: "Will the Fed cut rates?",
    polymarketTokenId: "token-yes",
  };
}

describe("prediction market movement", () => {
  it("keeps the existing Polymarket odds normalization", async () => {
    const http: HttpGet = async () => ({
      events: [
        {
          markets: [
            {
              ...polyMarket("Will the Fed cut rates?", "fed-cut"),
              outcomePrices: JSON.stringify(["0.2", "0.2"]),
            },
          ],
        },
      ],
    });
    const markets = await getPolymarketPredictionData(10, "fed", http);
    assert.equal(markets.length, 1);
    assert.equal(markets[0].odds.Yes, 0.5);
    assert.equal(markets[0].odds.No, 0.5);
    assert.equal(exportedSearch, getPolymarketPredictionData);
  });

  it("computes a Polymarket move from prices inside the window", async () => {
    const http: HttpGet = async (url) => {
      assert.match(url, /prices-history/);
      return {
        history: [
          { t: start - 10, p: 0.1 },
          { t: start + 60, p: 0.42 },
          { t: start + 80_000, p: 0.55 },
        ],
      };
    };
    const { movement, warning } = await computeMovement(trackedPoly(), "24h", NOW, http);
    assert.equal(warning, undefined);
    assert.equal(movement?.from, 0.42);
    assert.equal(movement?.to, 0.55);
    assert.equal(movement?.change, 0.13);
    assert.equal(movement?.high, 0.55);
    assert.equal(movement?.low, 0.42);
    assert.equal(movement?.basis, "trade_history");
    assert.equal(movement?.observations, 2);
  });

  it("computes a Kalshi move from candlesticks", async () => {
    const market: TrackedMarket = {
      ...trackedPoly(),
      platform: "kalshi",
      id: "FED-26",
      polymarketTokenId: undefined,
      kalshiSeriesTicker: "FED",
      kalshiTicker: "FED-26",
    };
    const http: HttpGet = async (url, query) => {
      assert.match(url, /candlesticks/);
      assert.equal(query?.period_interval, 60);
      return {
        candlesticks: [
          {
            end_period_ts: 1,
            price: { open_dollars: "0.4000", close_dollars: "0.4200", high_dollars: "0.4500", low_dollars: "0.3900" },
          },
          {
            end_period_ts: 2,
            price: { open_dollars: "0.4200", close_dollars: "0.5500", high_dollars: "0.5600", low_dollars: "0.4100" },
          },
        ],
      };
    };
    const { movement } = await computeMovement(market, "24h", NOW, http);
    assert.equal(movement?.from, 0.4);
    assert.equal(movement?.to, 0.55);
    assert.equal(movement?.high, 0.56);
    assert.equal(movement?.low, 0.39);
    assert.equal(movement?.basis, "trade_history");
  });

  it("uses PredictIt's previous close and does not invent a 24h series", async () => {
    const market: TrackedMarket = {
      ...trackedPoly(),
      platform: "predictit",
      id: "10:20",
      polymarketTokenId: undefined,
      predictItFrom: 0.4,
      predictItTo: 0.55,
    };
    const { movement, warning } = await computeMovement(market, "24h", NOW, async () => {
      throw new Error("no history endpoint");
    });
    assert.equal(movement?.basis, "previous_close");
    assert.equal(movement?.from, 0.4);
    assert.equal(movement?.to, 0.55);
    assert.match(warning ?? "", /not the requested lookback/);

    const missing = await computeMovement({ ...market, predictItFrom: 0 }, "24h", NOW, async () => ({}));
    assert.equal(missing.movement, null);
  });

  it("returns candidates when more than one market matches", async () => {
    const http: HttpGet = async (url) => {
      if (url.includes("public-search")) {
        return {
          events: [
            {
              markets: [
                polyMarket("Will the Fed cut rates?", "fed-cut"),
                polyMarket("Will the Fed hike rates?", "fed-hike"),
              ],
            },
          ],
        };
      }
      if (url.includes("predictit")) return { markets: [] };
      if (url.includes("kalshi")) return { events: [] };
      throw new Error(url);
    };
    const resolved = await resolveMarket("fed", undefined, http);
    assert.equal(resolved.status, "ambiguous");
    if (resolved.status === "ambiguous") {
      assert.equal(resolved.matchCount, 2);
      assert.equal(resolved.candidates.length, 2);
      assert.equal(resolved.candidates[0].id, "fed-cut");
    }
  });

  it("resolves one direct Polymarket slug", async () => {
    const http: HttpGet = async (url, query) => {
      assert.match(url, /gamma-api.polymarket.com\/markets/);
      assert.equal(query?.slug, "fed-cut");
      return [polyMarket("Will the Fed cut rates?", "fed-cut")];
    };
    const resolved = await resolveMarket("polymarket:fed-cut", undefined, http);
    assert.equal(resolved.status, "found");
    if (resolved.status === "found") {
      assert.equal(resolved.market.polymarketTokenId, "token-yes");
      assert.equal(resolved.market.outcome, "Yes");
    }
  });
});
