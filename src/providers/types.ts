import { SourceName, SourceSearchResult } from "../evidence/types.js";

export type SearchRequest = {
  query: string;
  sources: SourceName[];
  limit: number;
};

export interface ContextProvider {
  readonly id: string;
  search(request: SearchRequest): Promise<SourceSearchResult[]>;
}

export type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  errorCode?: string;
};

export type CommandRunner = (
  argv: string[],
  options?: { timeoutMs?: number; env?: NodeJS.ProcessEnv },
) => Promise<CommandResult>;
