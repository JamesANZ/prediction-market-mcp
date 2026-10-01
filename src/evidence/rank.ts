import { canonicalUrl } from "../text.js";
import { Evidence, RetrievedItem } from "./types.js";

const STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "and",
  "or",
  "for",
  "in",
  "on",
  "at",
  "by",
  "will",
  "be",
  "is",
  "this",
  "that",
  "with",
  "from",
  "as",
]);

const STALE_CAP = 3;

export function prepareEvidence(
  items: RetrievedItem[],
  question: string,
  windowStart: Date,
  windowEnd: Date,
  limit: number,
): { evidence: Evidence[]; warnings: string[] } {
  const warnings: string[] = [];
  const urlDeduped = dedupeUrls(items);
  if (urlDeduped.removed > 0) warnings.push(`Removed ${urlDeduped.removed} duplicate evidence items.`);
  const titleDeduped = dedupeTitles(urlDeduped.items);
  if (titleDeduped.removed > 0) warnings.push(`Removed ${titleDeduped.removed} near-duplicate stories.`);

  const scored = titleDeduped.items.map((item) => scoreItem(item, question, windowStart, windowEnd));
  scored.sort((a, b) => {
    const band = bandOf(a, windowStart) - bandOf(b, windowStart);
    if (band !== 0) return band;
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    return (timeOf(b.publishedAt) ?? 0) - (timeOf(a.publishedAt) ?? 0);
  });

  const selected: Evidence[] = [];
  let staleCount = 0;
  let omitted = 0;
  for (const item of scored) {
    const stale = item.stale;
    if (selected.length >= limit || (stale && staleCount >= STALE_CAP)) {
      omitted += 1;
      continue;
    }
    if (stale) staleCount += 1;
    selected.push(item);
  }
  if (omitted > 0) warnings.push(`Omitted ${omitted} lower-ranked evidence items.`);
  return { evidence: selected, warnings };
}

function dedupeUrls(items: RetrievedItem[]): { items: RetrievedItem[]; removed: number } {
  const byUrl = new Map<string, RetrievedItem>();
  let removed = 0;
  for (const item of items) {
    let key = item.url;
    try {
      key = canonicalUrl(item.url);
    } catch {
      removed += 1;
      continue;
    }
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, item);
      continue;
    }
    removed += 1;
    byUrl.set(key, newer(existing, item));
  }
  return { items: [...byUrl.values()], removed };
}

function dedupeTitles(items: RetrievedItem[]): { items: RetrievedItem[]; removed: number } {
  const kept: RetrievedItem[] = [];
  const ordered = [...items].sort((a, b) => (timeOf(b.publishedAt) ?? 0) - (timeOf(a.publishedAt) ?? 0));
  let removed = 0;
  for (const item of ordered) {
    const tokens = tokenSet(item.title);
    const duplicate = kept.some((existing) => jaccard(tokens, tokenSet(existing.title)) > 0.8);
    if (duplicate) {
      removed += 1;
      continue;
    }
    kept.push(item);
  }
  return { items: kept, removed };
}

function scoreItem(item: RetrievedItem, question: string, start: Date, end: Date): Evidence {
  const published = timeOf(item.publishedAt);
  const stale = published != null && published < start.getTime();
  const span = Math.max(1, end.getTime() - start.getTime());
  const recency =
    published == null ? 0 : clamp(1 - (end.getTime() - published) / span, 0, 1);
  const overlap = lexicalOverlap(question, `${item.title} ${item.excerpt}`);
  const rankScore = roundScore(0.7 * recency + 0.3 * overlap);
  return { ...item, stale, rankScore };
}

function bandOf(item: Evidence, start: Date): number {
  const published = timeOf(item.publishedAt);
  if (published == null) return 1;
  if (published < start.getTime()) return 2;
  return 0;
}

function newer(left: RetrievedItem, right: RetrievedItem): RetrievedItem {
  return (timeOf(right.publishedAt) ?? -1) >= (timeOf(left.publishedAt) ?? -1) ? right : left;
}

function timeOf(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function tokenSet(value: string): Set<string> {
  const tokens = value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP.has(token));
  return new Set(tokens);
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function lexicalOverlap(question: string, text: string): number {
  const wanted = tokenSet(question);
  if (wanted.size === 0) return 0;
  const seen = tokenSet(text);
  let hits = 0;
  for (const token of wanted) if (seen.has(token)) hits += 1;
  return hits / wanted.size;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  return Math.round(value * 10000) / 10000;
}
