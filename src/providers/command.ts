import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { CommandResult, CommandRunner } from "./types.js";

const MAX_BYTES = 256 * 1024;

export function commandExists(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const paths = (env.PATH ?? "").split(delimiter).filter(Boolean);
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  return paths.some((dir) => extensions.some((ext) => existsSync(join(dir, `${name}${ext}`))));
}

export const runCommand: CommandRunner = (argv, options) => {
  const timeoutMs = options?.timeoutMs ?? 20_000;
  if (argv.length === 0) {
    return Promise.resolve({
      exitCode: null,
      stdout: "",
      stderr: "empty command",
      timedOut: false,
      truncated: false,
      errorCode: "EINVAL",
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let child;
    try {
      child = spawn(argv[0], argv.slice(1), {
        shell: false,
        env: options?.env ?? process.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      finish({
        exitCode: null,
        stdout: "",
        stderr: err.message,
        timedOut: false,
        truncated: false,
        errorCode: err.code,
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let truncated = false;
    const capture = (current: string, chunk: Buffer) => {
      if (truncated) return current;
      const next = current + chunk.toString("utf8");
      if (Buffer.byteLength(next, "utf8") > MAX_BYTES) {
        truncated = true;
        child.kill("SIGKILL");
        return next.slice(0, MAX_BYTES);
      }
      return next;
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = capture(stdout, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = capture(stderr, chunk);
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ exitCode: null, stdout, stderr, timedOut: true, truncated, errorCode: "ETIMEDOUT" });
    }, timeoutMs);

    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      finish({
        exitCode: null,
        stdout,
        stderr: stderr || error.message,
        timedOut: false,
        truncated,
        errorCode: error.code,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      finish({ exitCode: code, stdout, stderr, timedOut: false, truncated });
    });
  });
};
