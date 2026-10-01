import { sanitizeQuery } from "../text.js";
import { SearchQuery } from "./types.js";

const GENERIC_OUTCOMES = new Set(["yes", "no"]);

export function buildSearchQueries(
  question: string,
  outcome: string,
  caller?: string[],
): SearchQuery[] {
  if (caller && caller.length > 0) {
    const cleaned = caller
      .map((query) => sanitizeQuery(query))
      .filter((query) => query.length > 0)
      .slice(0, 3);
    return cleaned.map((text, index) => ({
      text,
      origin: "caller",
      executed: index === 0,
    }));
  }

  const base = sanitizeQuery(question.replace(/\?+\s*$/, ""));
  if (!base) return [];
  const queries: SearchQuery[] = [{ text: base, origin: "generated", executed: true }];
  if (!GENERIC_OUTCOMES.has(outcome.trim().toLowerCase())) {
    const withOutcome = sanitizeQuery(`${base} ${outcome}`);
    if (withOutcome && withOutcome !== base) {
      queries.push({ text: withOutcome, origin: "generated", executed: false });
    }
  }
  return queries;
}
