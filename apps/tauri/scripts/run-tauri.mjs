#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import process from "node:process";
import { fileURLToPath } from "node:url";

const TAURI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(TAURI_DIR, "../..");

function log(message) {
  process.stdout.write(`[propai-desktop] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[propai-desktop] ${message}\n`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  log(`$ ${cmd} ${args.map((a) => JSON.stringify(a)).join(" ")}`);
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd ?? TAURI_DIR,
    stdio: "inherit",
    env: { ...process.env, ...(opts.env ?? {}) },
    shell: false,
  });
  if (res.error) {
    fail(`Command failed to start: ${cmd} (${String(res.error)})`);
  }
  process.exit(res.status ?? 1);
}

function runPnpm(args, opts = {}) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (npmExecPath) {
    run(process.execPath, [npmExecPath, ...args], { cwd: REPO_ROOT, ...opts });
    return;
  }
  if (process.platform === "win32") {
    run("pnpm.cmd", args, { cwd: REPO_ROOT, ...opts });
    return;
  }
  run("pnpm", args, { cwd: REPO_ROOT, ...opts });
}

function resolveTauriCliJs() {
  // Prefer resolve() so pnpm's store layout is handled correctly.
  const require = createRequire(import.meta.url);
  for (const base of [TAURI_DIR, REPO_ROOT]) {
    try {
      const resolved = require.resolve("@tauri-apps/cli/tauri.js", { paths: [base] });
      if (resolved && fs.existsSync(resolved)) {
        return resolved;
      }
    } catch {
      // keep scanning
    }
  }

  const direct = path.resolve(TAURI_DIR, "node_modules", "@tauri-apps", "cli", "tauri.js");
  if (fs.existsSync(direct)) {
    return direct;
  }

  return null;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    fail("Usage: node scripts/run-tauri.mjs <tauri-args...>");
  }

  const subcommand = String(args[0] ?? "");
  const env =
    subcommand === "build" || subcommand === "bundle"
      ? {
          TAURI_LOG: process.env.TAURI_LOG?.trim() ? process.env.TAURI_LOG : "trace",
          RUST_BACKTRACE: process.env.RUST_BACKTRACE?.trim()
            ? process.env.RUST_BACKTRACE
            : "1",
        }
      : {};

  const cliJs = resolveTauriCliJs();
  if (cliJs) {
    log(`Using local Tauri CLI: ${cliJs}`);
    run(process.execPath, [cliJs, ...args], { cwd: TAURI_DIR, env });
  }

  // Fallback: run Tauri CLI via `pnpm dlx` (avoids relying on PATH shims like `tauri.cmd`).
  runPnpm(["dlx", "@tauri-apps/cli@^2.0.0", ...args], { env });
}

main();


