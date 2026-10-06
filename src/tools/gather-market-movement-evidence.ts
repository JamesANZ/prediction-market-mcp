import { z } from "zod";
import { DISCLAIMER, EvidenceEnvelope, sealEnvelope } from "../evidence/envelope.js";
import { PassthroughEvidenceFilter, EvidenceFilter } from "../evidence/filter.js";
import { buildSearchQueries } from "../evidence/queries.js";
import { prepareEvidence } from "../evidence/rank.js";
import { SourceName, SourceSearchResult } from "../evidence/types.js";
import { HttpGet, getJson } from "../http.js";
import { computeMovement, windowFor } from "../markets/movement.js";
import { publicMarket, resolveMarket } from "../markets/resolve.js";
import { Lookback } from "../markets/types.js";
import { AgentReachCliProvider, ProviderDeps } from "../providers/agent-reach.js";
import { ContextProvider } from "../providers/types.js";

const sourceSchema = z.enum(["web", "x", "reddit", "youtube"]);

export const gatherMarketMovementInput = {
  market: z
    .string()
    .min(1)
    .max(300)
    .describe(
      "Keyword, or a direct id: polymarket:<slug-or-id>, kalshi:<ticker>, predictit:<marketId>[:<contractId>]",
    ),
  outcome: z
    .string()
    .min(1)
    .max(80)
    .optional()
    .describe("Outcome to measure, such as Yes. Needed when several contracts match."),
  lookback: z
    .enum(["1h", "6h", "24h", "7d", "30d"])
    .default("24h")
    .describe("Price window. PredictIt can only compare the previous close with the last trade."),
  sources: z
    .array(sourceSchema)
    .min(1)
    .max(4)
    .default(["web", "x", "reddit", "youtube"])
    .describe("External sources to search. Unavailable sources are reported and skipped."),
  queries: z
    .array(z.string().min(1).max(180))
    .max(3)
    .optional()
    .describe("Optional search queries. When set, they replace generated queries. Only the first is executed."),
  limit: z.number().int().min(1).max(10).default(8).describe("Maximum evidence items to return."),
};

export type GatherInput = {
  market: string;
  outcome?: string;
  lookback?: Lookback;
  sources?: SourceName[];
  queries?: string[];
  limit?: number;
};

export type GatherDeps = ProviderDeps & {
  http?: HttpGet;
  provider?: ContextProvider;
  filter?: EvidenceFilter;
  clock?: () => Date;
};

export async function gatherMarketMovementEvidence(
  input: GatherInput,
  deps: GatherDeps = {},
): Promise<EvidenceEnvelope> {
  const now = deps.clock?.() ?? new Date();
  const http = deps.http ?? getJson;
  const lookback = input.lookback ?? "24h";
  const limit = input.limit ?? 8;
  const sources = [...new Set(input.sources?.length ? input.sources : (["web", "x", "reddit", "youtube"] as SourceName[]))];
  const resolution = await resolveMarket(input.market, input.outcome, http);

  if (resolution.status === "ambiguous") {
    return sealEnvelope({
      status: "ambiguous",
      market: null,
      candidates: resolution.candidates,
      movement: null,
      searchQueries: [],
      sources: [],
      evidence: [],
      warnings: resolution.warnings,
    });
  }
  if (resolution.status === "not_found") {
    return sealEnvelope({
      status: "not_found",
      market: null,
      movement: null,
      searchQueries: [],
      sources: [],
      evidence: [],
      warnings: resolution.warnings,
    });
  }

  const warnings = [...resolution.warnings];
  const movementResult = await computeMovement(resolution.market, lookback, now, http);
  if (movementResult.warning) warnings.push(movementResult.warning);

  const searchQueries = buildSearchQueries(resolution.market.question, resolution.market.outcome, input.queries);
  const executed = searchQueries.find((query) => query.executed);
  if (searchQueries.some((query) => !query.executed)) {
    warnings.push("Only the first search query was executed.");
  }

  const provider = deps.provider ?? new AgentReachCliProvider(deps);
  let sourceResults: SourceSearchResult[] = sources.map((source) => ({
    source,
    status: "unavailable" as const,
    backend: null,
    evidence: [],
    warning: "No search query could be built.",
  }));
  if (executed) {
    sourceResults = await provider.search({ query: executed.text, sources, limit });
  } else {
    warnings.push("No search query could be built.");
  }
  if (provider instanceof AgentReachCliProvider) warnings.push(...provider.takeWarnings());

  const filter = deps.filter ?? new PassthroughEvidenceFilter();
  const retrieved = filter.filter(sourceResults.flatMap((source) => source.evidence));
  const { start, end } = windowFor(lookback, now);
  const ranked = prepareEvidence(retrieved, resolution.market.question, start, end, limit);
  warnings.push(...ranked.warnings);

  const failed = sourceResults.some((source) =>
    ["unavailable", "auth_required", "rate_limited", "error"].includes(source.status),
  );
  if (!failed && ranked.evidence.length === 0 && executed) {
    warnings.push("No matching external items were found.");
  }
  for (const source of sourceResults) {
    if (source.warning && source.status !== "ok") warnings.push(`${source.source}: ${source.warning}`);
  }

  return sealEnvelope({
    status: failed || !executed ? "partial" : "ok",
    market: publicMarket(resolution.market),
    movement: movementResult.movement,
    searchQueries,
    sources: sourceResults,
    evidence: ranked.evidence,
    warnings,
  });
}

export function evidenceResponse(envelope: EvidenceEnvelope) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(envelope, null, 2) }],
  };
}

export { DISCLAIMER };
