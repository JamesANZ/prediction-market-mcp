import { clipText, isHttpUrl } from "../text.js";
import { RetrievedItem, SourceName } from "./types.js";

const EXCERPT_LIMIT = 480;

type Draft = {
  title?: string;
  url?: string;
  publishedAt?: string | null;
  author?: string | null;
  excerpt?: string;
};

export function itemsFromCommandOutput(
  source: SourceName,
  backend: string,
  stdout: string,
  retrievedAt: string,
): { items: RetrievedItem[]; skipped: number } {
  const records = extractRecords(stdout);
  const items: RetrievedItem[] = [];
  let skipped = 0;
  for (const record of records) {
    const draft = source === "youtube" ? fromYoutube(record) : fromGeneric(record, source);
    if (!draft.url || !isHttpUrl(draft.url)) {
      skipped += 1;
      continue;
    }
    const excerpt = clipText(draft.excerpt || draft.title || "", EXCERPT_LIMIT);
    items.push({
      source,
      backend,
      title: clipText(draft.title || draft.url, 180).text,
      url: draft.url,
      publishedAt: draft.publishedAt ?? null,
      author: draft.author ?? null,
      excerpt: excerpt.text,
      retrievedAt,
      truncated: excerpt.truncated,
    });
  }
  return { items, skipped };
}

function fromGeneric(record: Record<string, unknown>, source: SourceName): Draft {
  const title = stringValue(record, ["title", "name", "text", "full_text", "content"]);
  const url =
    stringValue(record, ["url", "link", "tweet_url", "permalink", "webpage_url"]) ??
    twitterUrl(record) ??
    redditUrl(record);
  const author =
    stringValue(record, ["author", "username", "screen_name", "channel", "uploader"]) ??
    nestedString(record.user, ["name", "screen_name", "username"]) ??
    nestedString(record.author, ["name", "username", "screen_name"]);
  const excerpt = stringValue(record, ["text", "full_text", "selftext", "summary", "description", "content", "excerpt"]);
  return {
    title: title ?? undefined,
    url: url ?? undefined,
    publishedAt: publishedAt(record, source),
    author,
    excerpt: excerpt ?? undefined,
  };
}

function fromYoutube(record: Record<string, unknown>): Draft {
  const id = stringValue(record, ["id", "video_id"]);
  const url =
    stringValue(record, ["webpage_url", "url", "original_url"]) ??
    (id ? `https://www.youtube.com/watch?v=${id}` : null);
  const upload = stringValue(record, ["upload_date"]);
  let publishedAt: string | null = null;
  if (upload && /^\d{8}$/.test(upload)) {
    publishedAt = `${upload.slice(0, 4)}-${upload.slice(4, 6)}-${upload.slice(6, 8)}T00:00:00.000Z`;
  } else {
    publishedAt = timestampValue(record.timestamp) ?? timestampValue(record.release_timestamp);
  }
  return {
    title: stringValue(record, ["title"]) ?? undefined,
    url: url ?? undefined,
    publishedAt,
    author: stringValue(record, ["channel", "uploader", "channel_name"]),
    excerpt: stringValue(record, ["description"]) ?? "",
  };
}

function twitterUrl(record: Record<string, unknown>): string | null {
  const id = stringValue(record, ["id", "id_str", "tweet_id"]);
  if (!id || !/^\d+$/.test(id)) return null;
  const screen = nestedString(record.user, ["screen_name", "username"]) ?? nestedString(record.author, ["username"]);
  return screen ? `https://x.com/${screen}/status/${id}` : `https://x.com/i/status/${id}`;
}

function redditUrl(record: Record<string, unknown>): string | null {
  const permalink = stringValue(record, ["permalink"]);
  if (!permalink) return null;
  if (isHttpUrl(permalink)) return permalink;
  if (permalink.startsWith("/")) return `https://www.reddit.com${permalink}`;
  return null;
}

function publishedAt(record: Record<string, unknown>, source: SourceName): string | null {
  const direct = stringValue(record, [
    "publishedAt",
    "published_at",
    "publishedDate",
    "published_date",
    "created_at",
    "createdAt",
    "date",
    "upload_date",
  ]);
  if (direct) {
    if (/^\d{8}$/.test(direct)) {
      return `${direct.slice(0, 4)}-${direct.slice(4, 6)}-${direct.slice(6, 8)}T00:00:00.000Z`;
    }
    const parsed = Date.parse(direct);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  const unix = record.created_utc ?? record.createdUtc ?? record.timestamp;
  const fromUnix = timestampValue(unix);
  if (fromUnix) return fromUnix;
  if (source === "web") return null;
  return null;
}

function timestampValue(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const millis = value > 10_000_000_000 ? value : value * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stringValue(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function nestedString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  return stringValue(value as Record<string, unknown>, keys);
}

export function extractRecords(stdout: string): Record<string, unknown>[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every((line) => line.startsWith("{") || line.startsWith("["))) {
    const records = lines.flatMap((line) => {
      const parsed = parseDocument(line);
      return parsed === undefined ? [] : collectRecords(parsed);
    });
    if (records.length > 0) return records;
  }
  const parsed = parseDocument(trimmed);
  if (parsed !== undefined) return collectRecords(parsed);
  return collectRecords(parseLooseYaml(trimmed));
}

function parseDocument(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.search(/[[{]/);
    if (start < 0) return undefined;
    try {
      return JSON.parse(text.slice(start));
    } catch {
      return undefined;
    }
  }
}

function collectRecords(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRecords(item));
  }
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (record.ok === false) return [];
  if (typeof record.text === "string" && (record.type === "text" || record.content)) {
    const nested = parseDocument(record.text);
    if (nested !== undefined) return collectRecords(nested);
  }
  const containers = ["results", "tweets", "posts", "items", "data", "children", "content", "history"];
  const nested: Record<string, unknown>[] = [];
  for (const key of containers) {
    if (key in record) nested.push(...collectRecords(record[key]));
  }
  if (nested.length > 0) return nested;
  if (looksLikeItem(record)) return [unwrapListing(record)];
  return [];
}

function unwrapListing(record: Record<string, unknown>): Record<string, unknown> {
  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    const data = record.data as Record<string, unknown>;
    if (looksLikeItem(data)) return data;
  }
  return record;
}

function looksLikeItem(record: Record<string, unknown>): boolean {
  return ["title", "url", "link", "text", "full_text", "permalink", "webpage_url", "id"].some(
    (key) => key in record,
  );
}

function parseLooseYaml(text: string): Record<string, unknown>[] {
  const blocks = text.split(/\n(?=- )/g);
  const items: Record<string, unknown>[] = [];
  for (const block of blocks) {
    const record: Record<string, unknown> = {};
    for (const line of block.split("\n")) {
      const match = /^\s*-?\s*([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
      if (!match) continue;
      record[match[1]] = match[2].replace(/^['"]|['"]$/g, "").trim();
    }
    if (Object.keys(record).length > 0) items.push(record);
  }
  return items;
}
