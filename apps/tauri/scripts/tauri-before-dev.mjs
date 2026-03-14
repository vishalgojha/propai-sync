#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const TAURI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(TAURI_DIR, "../..");

function log(message) {
  process.stdout.write(`[openclaw-desktop] ${message}\n`);
}

function spawnPnpm(args, opts = {}) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (npmExecPath) {
    return spawn(process.execPath, [npmExecPath, ...args], {
      cwd: opts.cwd ?? REPO_ROOT,
      stdio: "inherit",
      env: { ...process.env, ...(opts.env ?? {}) },
      shell: false,
    });
  }
  const cmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return spawn(cmd, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, ...(opts.env ?? {}) },
    shell: false,
  });
}

const uiDir = path.resolve(REPO_ROOT, "ui");
log(`Starting Vite dev server in ${uiDir}`);
const child = spawnPnpm(["--dir", uiDir, "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
  cwd: REPO_ROOT,
});
child.on("exit", (code) => process.exit(code ?? 1));

