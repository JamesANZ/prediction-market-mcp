import { CommandResult, CommandRunner } from "../src/providers/types.js";

export function commandResult(partial: Partial<CommandResult> = {}): CommandResult {
  return {
    exitCode: partial.exitCode ?? 0,
    stdout: partial.stdout ?? "",
    stderr: partial.stderr ?? "",
    timedOut: partial.timedOut ?? false,
    truncated: partial.truncated ?? false,
    errorCode: partial.errorCode,
  };
}

export function doctorReport(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    exa_search: { status: "warn", message: "Exa is configured but was not probed", active_backend: null },
    youtube: { status: "ok", message: "yt-dlp", active_backend: "yt-dlp" },
    twitter: { status: "warn", message: "credentials not verified", active_backend: null },
    reddit: { status: "warn", message: "login required", active_backend: null },
    ...overrides,
  });
}

export function scriptedRunner(
  respond: (argv: string[]) => CommandResult | Promise<CommandResult>,
): { run: CommandRunner; calls: string[][] } {
  const calls: string[][] = [];
  const run: CommandRunner = async (argv) => {
    calls.push(argv);
    if (argv[0] === "agent-reach" && argv[1] === "version") return commandResult({ stdout: "Agent Reach v1.5.0\n" });
    return respond(argv);
  };
  return { run, calls };
}

export const NOW = new Date("2026-10-01T00:00:00.000Z");

export function polyMarket(question: string, slug: string, yes = "0.55") {
  const yesPrice = Number(yes);
  return {
    question,
    description: "Resolution follows the official source.",
    slug,
    active: true,
    closed: false,
    outcomes: JSON.stringify(["Yes", "No"]),
    outcomePrices: JSON.stringify([yes, (1 - yesPrice).toFixed(4)]),
    clobTokenIds: JSON.stringify(["token-yes", "token-no"]),
    events: [{ slug: "fed-event" }],
  };
}
