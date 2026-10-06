export type SourceName = "web" | "x" | "reddit" | "youtube";

export type SourceStatus = "ok" | "empty" | "unavailable" | "auth_required" | "rate_limited" | "error";

export type RetrievedItem = {
  source: SourceName;
  backend: string;
  title: string;
  url: string;
  publishedAt: string | null;
  author: string | null;
  excerpt: string;
  retrievedAt: string;
  truncated: boolean;
};

export type Evidence = RetrievedItem & {
  stale: boolean;
  rankScore: number;
};

export type SourceSearchResult = {
  source: SourceName;
  status: SourceStatus;
  backend: string | null;
  evidence: RetrievedItem[];
  warning?: string;
};

export type SearchQuery = {
  text: string;
  origin: "generated" | "caller";
  executed: boolean;
};
