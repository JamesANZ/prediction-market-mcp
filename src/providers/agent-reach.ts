import { itemsFromCommandOutput } from "../evidence/normalize.js";
import { SourceName, SourceSearchResult } from "../evidence/types.js";
import { commandExists, runCommand } from "./command.js";
import { CommandResult, CommandRunner, ContextProvider, SearchRequest } from "./types.js";

/**
 * Command table pinned to Agent Reach 1.5.0.
 * Agent Reach installs and health-checks upstream tools. It does not search.
 * `doctor --json` often leaves active_backend null for Twitter, Reddit, and Exa,
 * so a warn status still attempts the documented read-only command.
 * twitter-cli's current flag is `--max`; the skill text's `-n` is the same limit.
 */

const DOCTOR_TTL_MS = 60_000;
const SOURCE_CHANNELS: Record<SourceName, string> = {
  web: "exa_search",
  x: "twitter",
  reddit: "reddit",
  youtube: "youtube",
};

type DoctorChannel = {
  status?: string;
  message?: string;
  active_backend?: string | null;
};

type DoctorReport = Record<string, DoctorChannel>;

type DoctorLoad =
  | { kind: "missing"; warning: string }
  | { kind: "failed"; warning: string }
  | { kind: "ok"; channels: DoctorReport };

export type ProviderDeps = {
  run?: CommandRunner;
  exists?: (name: string) => boolean;
  now?: () => number;
  env?: NodeJS.ProcessEnv;
};

export class AgentReachCliProvider implements ContextProvider {
  readonly id = "agent-reach";
  private warnings: string[] = [];
  private versionWarning: string | null = null;
  private cache: { at: number; report: DoctorLoad } | null = null;

  constructor(private readonly deps: ProviderDeps = {}) {}

  takeWarnings(): string[] {
    return [...this.warnings];
  }

  async search(request: SearchRequest): Promise<SourceSearchResult[]> {
    this.warnings = [];
    const report = await this.loadDoctor();
    if (this.versionWarning) this.warnings.push(this.versionWarning);
    if (report.kind === "missing") {
      return request.sources.map((source) => this.blocked(source, "unavailable", report.warning));
    }
    if (report.kind === "failed") {
      return request.sources.map((source) => this.blocked(source, "error", report.warning));
    }
    const settled = await Promise.allSettled(
      request.sources.map((source) => this.searchSource(source, request, report.channels)),
    );
    return settled.map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      return this.blocked(request.sources[index], "error", "The source search failed.");
    });
  }

  private async loadDoctor(): Promise<DoctorLoad> {
    const now = this.deps.now?.() ?? Date.now();
    if (this.cache && now - this.cache.at < DOCTOR_TTL_MS) return this.cache.report;

    const doctor = await this.run(["agent-reach", "doctor", "--json"]);
    let report: DoctorLoad;
    if (doctor.errorCode === "ENOENT") {
      report = {
        kind: "missing",
        warning:
          "Agent Reach is not installed. Prediction-market tools still work. Install https://github.com/Panniantong/Agent-Reach to search external sources.",
      };
    } else if (doctor.timedOut) {
      report = { kind: "failed", warning: "Agent Reach doctor timed out." };
    } else if (doctor.exitCode !== 0) {
      report = { kind: "failed", warning: "Agent Reach doctor failed." };
    } else {
      try {
        const parsed = JSON.parse(doctor.stdout) as DoctorReport;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          report = { kind: "failed", warning: "Agent Reach doctor returned an unexpected report." };
        } else {
          report = { kind: "ok", channels: parsed };
        }
      } catch {
        report = { kind: "failed", warning: "Agent Reach doctor returned malformed JSON." };
      }
    }

    if (report.kind === "ok") await this.noteVersion();
    this.cache = { at: now, report };
    return report;
  }

  private async noteVersion(): Promise<void> {
    if (this.versionWarning !== null) return;
    const version = await this.run(["agent-reach", "version"]);
    const match = /(\d+)\.\d+\.\d+/.exec(version.stdout);
    this.versionWarning =
      match && Number(match[1]) !== 1
        ? `Agent Reach ${match[0]} differs from the 1.x command table this server was built against.`
        : "";
  }

  private async searchSource(
    source: SourceName,
    request: SearchRequest,
    channels: DoctorReport,
  ): Promise<SourceSearchResult> {
    const channel = channels[SOURCE_CHANNELS[source]];
    if (!channel) return this.blocked(source, "unavailable", "Agent Reach did not report this source.");
    const status = channel.status ?? "off";
    const message = shorten(channel.message || "This source is not available.");
    if (status === "off") return this.blocked(source, "unavailable", message);
    if (status === "error") return this.blocked(source, "error", message);
    if (status !== "ok" && status !== "warn") return this.blocked(source, "unavailable", message);

    if (source === "youtube" && channel.active_backend && channel.active_backend !== "yt-dlp") {
      return this.blocked(source, "unavailable", `YouTube backend ${channel.active_backend} is not supported.`);
    }

    const command = this.commandFor(source, request.query, request.limit);
    if ("blocked" in command) return command.blocked;
    return this.execute(source, command.backend, command.argv);
  }

  private commandFor(
    source: SourceName,
    query: string,
    limit: number,
  ): { backend: string; argv: string[] } | { blocked: SourceSearchResult } {
    if (source === "web") {
      return {
        backend: "exa-via-mcporter",
        argv: ["mcporter", "call", "exa.web_search_exa", `query=${query}`, `numResults=${limit}`],
      };
    }
    if (source === "youtube") {
      return {
        backend: "yt-dlp",
        argv: ["yt-dlp", "--dump-json", "--flat-playlist", "--no-warnings", `ytsearch${limit}:${query}`],
      };
    }
    if (source === "x") {
      if (!this.exists("twitter")) {
        return {
          blocked: this.blocked(
            source,
            "unavailable",
            "twitter CLI is not on PATH. This server does not fall back to a browser session.",
          ),
        };
      }
      const env = this.deps.env ?? process.env;
      if (!env.TWITTER_AUTH_TOKEN || !env.TWITTER_CT0) {
        return {
          blocked: this.blocked(
            source,
            "auth_required",
            "Set TWITTER_AUTH_TOKEN and TWITTER_CT0 on the MCP server process. Saved Agent Reach cookies are not read automatically.",
          ),
        };
      }
      return {
        backend: "twitter-cli",
        argv: ["twitter", "search", query, "--max", String(limit), "--json"],
      };
    }
    if (this.exists("rdt")) {
      return { backend: "rdt-cli", argv: ["rdt", "search", query, "--limit", String(limit), "--json"] };
    }
    if (this.exists("opencli")) {
      return { backend: "opencli", argv: ["opencli", "reddit", "search", query, "-f", "yaml"] };
    }
    return {
      blocked: this.blocked(
        source,
        "unavailable",
        "Reddit requires rdt or a desktop OpenCLI session. Neither command is on PATH.",
      ),
    };
  }

  private async execute(source: SourceName, backend: string, argv: string[]): Promise<SourceSearchResult> {
    const result = await this.run(argv, { env: this.deps.env });
    if (result.errorCode === "ENOENT") {
      return this.blocked(source, "unavailable", `${argv[0]} is not installed.`, backend);
    }
    const failure = classifyCommand(result);
    if (failure) {
      return this.blocked(source, failure, failureWarning(result, failure), backend);
    }
    const retrievedAt = new Date().toISOString();
    const parsed = itemsFromCommandOutput(source, backend, result.stdout, retrievedAt);
    if (parsed.items.length === 0) {
      if (parsed.skipped > 0 || !isEmptyDocument(result.stdout)) {
        return this.blocked(source, "error", "Unrecognized response.", backend);
      }
      return { source, status: "empty", backend, evidence: [] };
    }
    const notes = [
      parsed.skipped > 0 ? `Skipped ${parsed.skipped} malformed items.` : "",
      result.truncated ? "Command output was truncated at 256KB." : "",
    ].filter(Boolean);
    return {
      source,
      status: "ok",
      backend,
      evidence: parsed.items,
      warning: notes.length > 0 ? notes.join(" ") : undefined,
    };
  }

  private blocked(
    source: SourceName,
    status: SourceSearchResult["status"],
    warning: string,
    backend: string | null = null,
  ): SourceSearchResult {
    return { source, status, backend, evidence: [], warning };
  }

  private run(argv: string[], options?: { env?: NodeJS.ProcessEnv }): Promise<CommandResult> {
    const runner = this.deps.run ?? runCommand;
    return runner(argv, { timeoutMs: 20_000, env: options?.env });
  }

  private exists(name: string): boolean {
    return (this.deps.exists ?? commandExists)(name);
  }
}

function classifyCommand(result: CommandResult): SourceSearchResult["status"] | null {
  const structured = structuredStatus(result.stdout);
  if (result.timedOut) return "error";
  if (structured) return structured;
  if (result.exitCode === 0) return null;
  return classifyText(`${result.stderr}\n${result.stdout}`);
}

function structuredStatus(stdout: string): SourceSearchResult["status"] | null {
  try {
    const data = JSON.parse(stdout) as { ok?: boolean; error?: { code?: string; message?: string } };
    if (!data || data.ok !== false) return null;
    return classifyText(`${data.error?.code ?? ""} ${data.error?.message ?? ""}`);
  } catch {
    return null;
  }
}

function classifyText(value: string): SourceSearchResult["status"] {
  const blob = value.toLowerCase();
  if (blob.includes("429") || blob.includes("rate limit") || blob.includes("rate_limited") || blob.includes("too many requests")) {
    return "rate_limited";
  }
  if (
    /\b401\b/.test(blob) ||
    /\b403\b/.test(blob) ||
    blob.includes("not_authenticated") ||
    blob.includes("login") ||
    blob.includes("unauthorized") ||
    blob.includes("forbidden") ||
    blob.includes("cookie") ||
    blob.includes("auth")
  ) {
    return "auth_required";
  }
  return "error";
}

function failureWarning(result: CommandResult, status: SourceSearchResult["status"]): string {
  if (result.timedOut) return "The command timed out.";
  const stderr = result.stderr.replace(/\s+/g, " ").trim();
  if (stderr) return shorten(stderr);
  if (status === "rate_limited") return "Rate limited.";
  if (status === "auth_required") return "Authentication or a logged-in session is required.";
  return "Command failed.";
}

function shorten(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 400 ? `${text.slice(0, 399)}…` : text;
}

function isEmptyDocument(stdout: string): boolean {
  const trimmed = stdout.trim();
  if (!trimmed) return true;
  try {
    JSON.parse(trimmed);
  } catch {
    return false;
  }
  return itemsFromCommandOutput("web", "probe", trimmed, new Date(0).toISOString()).items.length === 0 &&
    itemsFromCommandOutput("web", "probe", trimmed, new Date(0).toISOString()).skipped === 0;
}
