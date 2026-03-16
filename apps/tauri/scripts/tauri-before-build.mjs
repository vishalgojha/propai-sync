#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TAURI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(TAURI_DIR, "../..");
const SRC_TAURI_DIR = path.resolve(TAURI_DIR, "src-tauri");
const TAURI_CONFIG_PATH = path.resolve(SRC_TAURI_DIR, "tauri.conf.json");

function fail(message) {
  process.stderr.write(`[propai-desktop] ${message}\n`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  process.stdout.write(`[propai-desktop] $ ${cmd} ${args.map((a) => JSON.stringify(a)).join(" ")}\n`);
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, ...(opts.env ?? {}) },
    shell: false,
  });
  if (res.error) {
    fail(`Command failed to start: ${cmd} (${String(res.error)})`);
  }
  if (res.status !== 0) {
    fail(`Command failed (exit ${res.status ?? "?"}): ${cmd}`);
  }
}

function runPnpm(args, opts = {}) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (npmExecPath && !/\.(ps1|cmd|bat)$/i.test(npmExecPath)) {
    run(process.execPath, [npmExecPath, ...args], opts);
    return;
  }

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA?.trim();
    const candidates = [];
    if (localAppData) {
      candidates.push(path.resolve(localAppData, "pnpm", ".tools", "pnpm"));
    }

    const tryFindPnpmCjs = () => {
      for (const base of candidates) {
        try {
          if (!exists(base)) continue;
          const entries = fs.readdirSync(base, { withFileTypes: true });
          const sorted = entries
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort();
          for (let i = sorted.length - 1; i >= 0; i -= 1) {
            const name = sorted[i];
            if (!name) continue;
            const p = path.resolve(base, name, "node_modules", "pnpm", "bin", "pnpm.cjs");
            if (exists(p)) {
              return p;
            }
          }
        } catch {
          // ignore and continue
        }
      }
      return null;
    };

    const pnpmCjs = tryFindPnpmCjs();
    if (pnpmCjs) {
      run(process.execPath, [pnpmCjs, ...args], opts);
      return;
    }

    const corepackJs = path.resolve(
      path.dirname(process.execPath),
      "node_modules",
      "corepack",
      "dist",
      "corepack.js",
    );
    if (exists(corepackJs)) {
      run(process.execPath, [corepackJs, "pnpm", ...args], opts);
      return;
    }
  }

  try {
    run("pnpm", args, opts);
  } catch {
    const corepackCmd = process.platform === "win32" ? "corepack.cmd" : "corepack";
    run(corepackCmd, ["pnpm", ...args], opts);
  }
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function normalizeUpdaterArtifacts() {
  let raw = "";
  try {
    raw = fs.readFileSync(TAURI_CONFIG_PATH, "utf8");
  } catch {
    fail(`Unable to read ${TAURI_CONFIG_PATH}`);
  }

  let config = null;
  try {
    config = JSON.parse(raw);
  } catch {
    fail(`Unable to parse ${TAURI_CONFIG_PATH}`);
  }

  const hasSigningKey = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY?.trim());
  const desired = hasSigningKey;
  const bundle = typeof config.bundle === "object" && config.bundle ? config.bundle : {};
  const current = bundle.createUpdaterArtifacts ?? false;

  if (current === desired) {
    return;
  }

  bundle.createUpdaterArtifacts = desired;
  config.bundle = bundle;
  fs.writeFileSync(TAURI_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  process.stdout.write(
    `[propai-desktop] updater artifacts ${desired ? "enabled" : "disabled"} (${hasSigningKey ? "TAURI_SIGNING_PRIVATE_KEY set" : "TAURI_SIGNING_PRIVATE_KEY missing"})\n`,
  );
}

function ensureWindowsNsisTools() {
  if (process.platform !== "win32") {
    return;
  }

  // With `bundle.useLocalToolsDir=true`, tauri caches bundler tools under `src-tauri/target/.tauri`.
  const toolsDir = path.resolve(SRC_TAURI_DIR, "target", ".tauri");
  const nsisDir = path.resolve(toolsDir, "NSIS");
  const nsis3Dir = path.resolve(nsisDir, "nsis-3");
  const makensis = path.resolve(nsis3Dir, "makensis.exe");

  if (exists(makensis)) {
    return;
  }

  mkdirp(nsisDir);
  const downloadsDir = path.resolve(nsisDir, ".downloads");
  mkdirp(downloadsDir);

  const nsisZip = path.resolve(downloadsDir, "nsis-3.zip");
  const extractDir = path.resolve(downloadsDir, "extract");
  const nsisUrl =
    "https://github.com/tauri-apps/binary-releases/releases/download/nsis-3/nsis-3.zip";

  if (!exists(nsisZip)) {
    run(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Invoke-WebRequest -UseBasicParsing -Uri ${JSON.stringify(nsisUrl)} -OutFile ${JSON.stringify(nsisZip)}`,
      ],
      { cwd: REPO_ROOT },
    );
  }

  // Extract into a separate directory so we can normalize the layout without self-copy issues.
  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });
  run(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Expand-Archive -LiteralPath ${JSON.stringify(nsisZip)} -DestinationPath ${JSON.stringify(extractDir)} -Force`,
    ],
    { cwd: REPO_ROOT },
  );

  const findMakensis = (root) => {
    const queue = [root];
    while (queue.length > 0) {
      const current = queue.pop();
      if (!current) continue;
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          queue.push(full);
          continue;
        }
        if (!entry.isFile()) continue;
        if (entry.name.toLowerCase() === "makensis.exe") {
          return full;
        }
      }
    }
    return null;
  };

  const found = findMakensis(extractDir);
  if (!found) {
    fail(`NSIS cache did not contain makensis.exe anywhere under ${extractDir}`);
  }

  // Tauri expects a stable location. Copy the full NSIS root into `nsis-3/`.
  // Most zips place makensis at `<root>/Bin/makensis.exe`; detect that and normalize.
  const normalizedSourceRoot = (() => {
    const parts = found.split(path.sep).map((p) => p.toLowerCase());
    const binIndex = parts.lastIndexOf("bin");
    if (binIndex !== -1 && binIndex + 1 < parts.length && parts.at(-1) === "makensis.exe") {
      return found.split(path.sep).slice(0, binIndex).join(path.sep);
    }
    return path.dirname(found);
  })();

  fs.rmSync(nsis3Dir, { recursive: true, force: true });
  fs.mkdirSync(nsis3Dir, { recursive: true });
  fs.cpSync(normalizedSourceRoot, nsis3Dir, { recursive: true, dereference: true });

  // Ensure the exact expected path exists as a convenience shim.
  if (!exists(makensis)) {
    const candidate = path.resolve(nsis3Dir, "Bin", "makensis.exe");
    if (exists(candidate)) {
      fs.copyFileSync(candidate, makensis);
    }
  }

  if (!exists(makensis)) {
    fail(
      `NSIS cache did not contain makensis.exe at ${makensis} (found original at ${found}, copied from ${normalizedSourceRoot})`,
    );
  }
}

function main() {
  normalizeUpdaterArtifacts();
  ensureWindowsNsisTools();
  run(process.execPath, [path.resolve(TAURI_DIR, "scripts/prepare-bundle.mjs")], { cwd: TAURI_DIR });
}

main();


