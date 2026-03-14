#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TAURI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(TAURI_DIR, "../..");
const SRC_TAURI_DIR = path.resolve(TAURI_DIR, "src-tauri");
const RESOURCES_DIR = path.resolve(SRC_TAURI_DIR, "resources");
const PROPAI_RES_DIR = path.resolve(RESOURCES_DIR, "propai");
const NODE_RES_DIR = path.resolve(RESOURCES_DIR, "node");
const BUNDLE_CACHE_DIR = path.resolve(SRC_TAURI_DIR, "target", "desktop-bundle-cache");

function fail(message) {
  process.stderr.write(`[propai-desktop] ${message}\n`);
  process.exit(1);
}

function log(message) {
  process.stdout.write(`[propai-desktop] ${message}\n`);
}

function assertExists(targetPath, label) {
  if (fs.existsSync(targetPath)) {
    return;
  }
  fail(`${label} is missing: ${targetPath}`);
}

function assertDistEntryExists(dirPath, label) {
  const entryJs = path.resolve(dirPath, "entry.js");
  const entryMjs = path.resolve(dirPath, "entry.mjs");
  if (fs.existsSync(entryJs) || fs.existsSync(entryMjs)) {
    return;
  }
  fail(`${label} is missing dist/entry.(m)js (required by propai.mjs): ${dirPath}`);
}

function statFingerprint(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return null;
  }
  const stat = fs.statSync(targetPath);
  return {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    isDir: stat.isDirectory(),
  };
}

function readJson(pathname) {
  try {
    return JSON.parse(fs.readFileSync(pathname, "utf8"));
  } catch {
    return null;
  }
}

function hashCacheKey(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function fileSize(pathname) {
  try {
    return fs.statSync(pathname).size;
  } catch {
    return 0;
  }
}

function tryRemove(pathname) {
  try {
    fs.rmSync(pathname, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function tryCopy(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    return true;
  } catch {
    return false;
  }
}

function ensureNonEmptyFile(pathname, label) {
  const size = fileSize(pathname);
  if (size <= 0) {
    fail(`${label} is empty or missing: ${pathname}`);
  }
}

function run(cmd, args, opts = {}) {
  log(`$ ${cmd} ${args.map((a) => JSON.stringify(a)).join(" ")}`);
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
    // Prefer invoking pnpm via its JS entrypoint (works even when pnpm.cmd shim fails to spawn).
    const localAppData = process.env.LOCALAPPDATA?.trim();
    const candidates = [];
    if (localAppData) {
      // corepack/pnpm stores a temp tool path like:
      // %LOCALAPPDATA%\pnpm\.tools\pnpm\<ver>_tmp_xxxxx\node_modules\pnpm\bin\pnpm.cjs
      candidates.push(
        path.resolve(localAppData, "pnpm", ".tools", "pnpm"),
      );
    }

    const tryFindPnpmCjs = () => {
      for (const base of candidates) {
        try {
          if (!fs.existsSync(base)) continue;
          const entries = fs.readdirSync(base, { withFileTypes: true });
          // Prefer the lexicographically last entry (usually newest version).
          const sorted = entries
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort();
          for (let i = sorted.length - 1; i >= 0; i -= 1) {
            const name = sorted[i];
            if (!name) continue;
            const p = path.resolve(base, name, "node_modules", "pnpm", "bin", "pnpm.cjs");
            if (fs.existsSync(p)) {
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

    // Fall back to corepack via JS (corepack.cmd can be non-executable in some environments).
    const corepackJs = path.resolve(path.dirname(process.execPath), "node_modules", "corepack", "dist", "corepack.js");
    if (fs.existsSync(corepackJs)) {
      run(process.execPath, [corepackJs, "pnpm", ...args], opts);
      return;
    }
  }

  // Non-Windows / last resort.
  try {
    run("pnpm", args, opts);
  } catch {
    const corepackCmd = process.platform === "win32" ? "corepack.cmd" : "corepack";
    run(corepackCmd, ["pnpm", ...args], opts);
  }
}

function rmRF(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyTree(src, dest) {
  mkdirp(path.dirname(dest));
  fs.cpSync(src, dest, { recursive: true, dereference: true });
}

function writeFile(p, content) {
  mkdirp(path.dirname(p));
  fs.writeFileSync(p, content);
}

function ensureRepoBuildTooling() {
  const tsdownEntrypoint = path.resolve(REPO_ROOT, "node_modules", "tsdown", "dist", "run.mjs");
  if (fs.existsSync(tsdownEntrypoint)) {
    return;
  }

  log('Missing build tooling (tsdown). Running "pnpm install" at repo root.');
  const lock = path.resolve(REPO_ROOT, "pnpm-lock.yaml");
  const installArgs = fs.existsSync(lock)
    ? ["install", "--frozen-lockfile"]
    : ["install"];
  runPnpm(installArgs, { cwd: REPO_ROOT });
}

function resolveNodeTarget() {
  const platform = process.env.TAURI_PLATFORM ?? process.platform;
  const arch = process.env.TAURI_ARCH ?? process.arch;

  if (platform === "win32" || platform === "windows") {
    if (arch !== "x64") throw new Error(`Unsupported Windows arch: ${arch}`);
    return { platform: "win", arch: "x64", ext: "zip" };
  }
  if (platform === "darwin" || platform === "macos") {
    if (arch === "arm64") return { platform: "darwin", arch: "arm64", ext: "tar.xz" };
    if (arch === "x64") return { platform: "darwin", arch: "x64", ext: "tar.xz" };
    throw new Error(`Unsupported macOS arch: ${arch}`);
  }
  if (platform === "linux") {
    if (arch !== "x64") throw new Error(`Unsupported Linux arch: ${arch}`);
    return { platform: "linux", arch: "x64", ext: "tar.xz" };
  }

  throw new Error(`Unsupported platform: ${platform} (${arch})`);
}

function nodeFilenameForTarget(target) {
  return target.platform === "win" ? "node.exe" : "node";
}

function nodeArchiveName(version, target) {
  if (target.platform === "win") {
    return `node-v${version}-win-${target.arch}.zip`;
  }
  return `node-v${version}-${target.platform}-${target.arch}.tar.xz`;
}

function downloadNode(version) {
  const target = resolveNodeTarget();
  const archive = nodeArchiveName(version, target);
  const url = `https://nodejs.org/dist/v${version}/${archive}`;
  const tmpDir = path.resolve(SRC_TAURI_DIR, "target", "desktop-bundle-tmp");
  const archivePath = path.resolve(tmpDir, archive);
  const extractDir = path.resolve(tmpDir, "node-extract");

  mkdirp(tmpDir);
  rmRF(extractDir);
  mkdirp(extractDir);

  if (!fs.existsSync(archivePath)) {
    if (process.platform === "win32") {
      run(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Invoke-WebRequest -UseBasicParsing -Uri ${JSON.stringify(url)} -OutFile ${JSON.stringify(archivePath)}`,
        ],
        { cwd: REPO_ROOT },
      );
    } else {
      run("curl", ["-fL", "-o", archivePath, url], { cwd: REPO_ROOT });
    }
  }

  if (target.ext === "zip") {
    if (process.platform === "win32") {
      run(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Expand-Archive -LiteralPath ${JSON.stringify(archivePath)} -DestinationPath ${JSON.stringify(extractDir)} -Force`,
        ],
        { cwd: REPO_ROOT },
      );
    } else {
      run("unzip", ["-q", "-o", archivePath, "-d", extractDir], { cwd: REPO_ROOT });
    }
  } else {
    run("tar", ["-xJf", archivePath, "-C", extractDir], { cwd: REPO_ROOT });
  }

  const folderName =
    target.platform === "win"
      ? `node-v${version}-win-${target.arch}`
      : `node-v${version}-${target.platform}-${target.arch}`;
  const nodeBinRel =
    target.platform === "win"
      ? path.join(folderName, "node.exe")
      : path.join(folderName, "bin", "node");
  const nodeBin = path.resolve(extractDir, nodeBinRel);
  if (!fs.existsSync(nodeBin)) {
    throw new Error(`Node binary not found after extract: ${nodeBin}`);
  }

  mkdirp(NODE_RES_DIR);
  const outPath = path.resolve(NODE_RES_DIR, nodeFilenameForTarget(target));
  fs.copyFileSync(nodeBin, outPath);
  if (target.platform !== "win") {
    fs.chmodSync(outPath, 0o755);
  }

  return outPath;
}

function ensurePropAiSyncDist() {
  // Always rebuild for desktop bundling so `resources/propai/dist` matches the current source.
  // This avoids subtle version skew where the desktop gateway runs stale JS.
  ensureRepoBuildTooling();
  runPnpm(["build"], { cwd: REPO_ROOT });
  assertDistEntryExists(path.resolve(REPO_ROOT, "dist"), "Repo build output");
}

function ensureControlUiDist() {
  const controlUiDir = path.resolve(REPO_ROOT, "dist", "control-ui");
  runPnpm(["--dir", path.resolve(REPO_ROOT, "ui"), "build"], { cwd: REPO_ROOT });
  assertExists(path.resolve(controlUiDir, "index.html"), "Control UI assets");
}

function stageNodeModules() {
  const repoNodeModules = path.resolve(REPO_ROOT, "node_modules");

  if (process.platform !== "win32") {
    if (!fs.existsSync(repoNodeModules)) {
      fail('Missing root "node_modules/". Run "pnpm install" at repo root first.');
    }
    copyTree(repoNodeModules, path.resolve(PROPAI_RES_DIR, "node_modules"));
    return;
  }

  // Windows: avoid copying pnpm's symlinked + deep `.pnpm/` tree (path length + junction issues).
  // Instead, install deps into the staged bundle using a hoisted node linker.
  //
  // Note: `PROPAI_RES_DIR` lives under the monorepo. Running `pnpm install` directly in that
  // folder can be interpreted as a workspace operation and may not create a local `node_modules/`
  // there. To keep this reproducible, install in a temp dir outside the workspace, then copy the
  // resulting `node_modules/` into the staged bundle.
  const stagedLock = path.resolve(PROPAI_RES_DIR, "pnpm-lock.yaml");
  const stagedNpmrc = path.resolve(PROPAI_RES_DIR, ".npmrc");
  const stagedPatches = path.resolve(PROPAI_RES_DIR, "patches");

  const lock = path.resolve(REPO_ROOT, "pnpm-lock.yaml");
  if (!fs.existsSync(lock)) {
    fail('Missing "pnpm-lock.yaml" in repo root.');
  }

  const cacheKey = {
    pnpmLock: statFingerprint(lock),
    packageJson: statFingerprint(path.resolve(REPO_ROOT, "package.json")),
    patches: statFingerprint(path.resolve(REPO_ROOT, "patches")),
  };
  const cacheKeyRaw = JSON.stringify(cacheKey);
  const cacheHash = hashCacheKey(cacheKeyRaw);
  const cacheZip = path.resolve(BUNDLE_CACHE_DIR, `node_modules.${cacheHash}.zip`);
  const cacheMeta = path.resolve(BUNDLE_CACHE_DIR, `node_modules.${cacheHash}.meta.json`);
  if (fs.existsSync(cacheZip) && fs.existsSync(cacheMeta)) {
    const cached = readJson(cacheMeta);
    if (cached && JSON.stringify(cached) === cacheKeyRaw) {
      mkdirp(BUNDLE_CACHE_DIR);
      const nodeModulesZip = path.resolve(PROPAI_RES_DIR, "node_modules.zip");
      if (tryCopy(cacheZip, nodeModulesZip)) {
        assertExists(nodeModulesZip, "Staged node_modules archive");
        log("Using cached node_modules.zip");
        return;
      }
      log("Cached node_modules.zip is locked; rebuilding.");
    }
  }

  copyTree(lock, stagedLock);
  const npmrc = path.resolve(REPO_ROOT, ".npmrc");
  if (fs.existsSync(npmrc)) {
    copyTree(npmrc, stagedNpmrc);
  }
  const patches = path.resolve(REPO_ROOT, "patches");
  if (fs.existsSync(patches)) {
    copyTree(patches, stagedPatches);
  }

  const tempBase = path.resolve(os.tmpdir(), "propai-desktop-pnpm");
  mkdirp(tempBase);
  const tempInstallDir = fs.mkdtempSync(path.join(tempBase, "install-"));

  copyTree(path.resolve(PROPAI_RES_DIR, "package.json"), path.resolve(tempInstallDir, "package.json"));
  copyTree(stagedLock, path.resolve(tempInstallDir, "pnpm-lock.yaml"));
  if (fs.existsSync(stagedNpmrc)) {
    copyTree(stagedNpmrc, path.resolve(tempInstallDir, ".npmrc"));
  }
  if (fs.existsSync(stagedPatches)) {
    copyTree(stagedPatches, path.resolve(tempInstallDir, "patches"));
  }

  runPnpm(
    // Note: the PropAi Sync runtime currently imports some packages that are classified as
    // devDependencies in the monorepo. For a fully redistributable desktop bundle, install the
    // full dependency graph (not `--prod`) to avoid ERR_MODULE_NOT_FOUND at runtime.
    ["install", "--frozen-lockfile", "--config.node-linker=hoisted", "--ignore-scripts"],
    { cwd: tempInstallDir },
  );

  const installedNodeModules = path.resolve(tempInstallDir, "node_modules");
  if (!fs.existsSync(installedNodeModules)) {
    fail(`Staged dependency install did not produce node_modules at: ${installedNodeModules}`);
  }

  const chalkPkg = path.resolve(installedNodeModules, "chalk", "package.json");
  if (!fs.existsSync(chalkPkg)) {
    fail(`Staged dependency install is missing chalk at: ${chalkPkg}`);
  }

  // Bundle node_modules as a single archive. Some bundlers/installers omit `node_modules/` trees by
  // default; shipping a zip avoids that class of issues and lets the desktop gateway extract on
  // first run.
  mkdirp(BUNDLE_CACHE_DIR);
  const tempZip = path.resolve(
    BUNDLE_CACHE_DIR,
    `node_modules.tmp-${process.pid}-${Date.now()}.zip`,
  );
  tryRemove(tempZip);
  const archiveArgs = [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Compress-Archive -LiteralPath ${JSON.stringify(installedNodeModules)} -DestinationPath ${JSON.stringify(tempZip)} -Force`,
  ];
  run("powershell.exe", archiveArgs, { cwd: REPO_ROOT });
  if (fileSize(tempZip) <= 0) {
    log("Compress-Archive produced an empty zip; retrying with tar.");
    tryRemove(tempZip);
    run(
      "tar",
      [
        "-acf",
        tempZip,
        "-C",
        path.dirname(installedNodeModules),
        path.basename(installedNodeModules),
      ],
      { cwd: REPO_ROOT },
    );
  }
  ensureNonEmptyFile(tempZip, "Staged node_modules archive");
  if (tryCopy(tempZip, cacheZip)) {
    fs.writeFileSync(cacheMeta, `${cacheKeyRaw}\n`);
  } else {
    log("Cache zip write failed (locked); continuing without cache update.");
  }
  const nodeModulesZip = path.resolve(PROPAI_RES_DIR, "node_modules.zip");
  fs.copyFileSync(tempZip, nodeModulesZip);
  assertExists(nodeModulesZip, "Staged node_modules archive");
}

function writeDesktopManifest() {
  const manifest = {
    format: 1,
    createdAt: new Date().toISOString(),
    node: {
      // Keep aligned with `propai.mjs` minimum (>= 22.12).
      version: "22.12.0",
    },
  };
  writeFile(path.resolve(RESOURCES_DIR, "desktop-bundle.json"), `${JSON.stringify(manifest)}\n`);
  return manifest;
}

function stagePropAiSync() {
  rmRF(PROPAI_RES_DIR);
  mkdirp(PROPAI_RES_DIR);

  // Runtime entrypoints + assets.
  copyTree(path.resolve(REPO_ROOT, "propai.mjs"), path.resolve(PROPAI_RES_DIR, "propai.mjs"));
  copyTree(path.resolve(REPO_ROOT, "package.json"), path.resolve(PROPAI_RES_DIR, "package.json"));
  const repoDist = path.resolve(REPO_ROOT, "dist");
  assertExists(repoDist, "Repo dist directory");
  copyTree(repoDist, path.resolve(PROPAI_RES_DIR, "dist"));
  copyTree(path.resolve(REPO_ROOT, "assets"), path.resolve(PROPAI_RES_DIR, "assets"));
  copyTree(path.resolve(REPO_ROOT, "skills"), path.resolve(PROPAI_RES_DIR, "skills"));
  const templates = path.resolve(REPO_ROOT, "docs", "reference", "templates");
  if (fs.existsSync(templates)) {
    copyTree(templates, path.resolve(PROPAI_RES_DIR, "docs", "reference", "templates"));
  }

  stageNodeModules();

  assertDistEntryExists(path.resolve(PROPAI_RES_DIR, "dist"), "Staged PropAi Sync runtime");
}

function main() {
  log(`Preparing bundle (platform=${process.platform}, arch=${process.arch})`);
  mkdirp(RESOURCES_DIR);
  const manifest = writeDesktopManifest();
  ensurePropAiSyncDist();
  ensureControlUiDist();
  stagePropAiSync();
  downloadNode(manifest.node.version);
  // IMPORTANT: tauri `bundle.resources=["resources/**/*"]` does not include dotfiles at the root
  // of `resources/`, so write the stamp under `resources/propai/` (which is included) to allow
  // the desktop runtime to detect updates and re-extract.
  const stamp = `${new Date().toISOString()}\n`;
  writeFile(path.resolve(PROPAI_RES_DIR, ".prepared"), stamp);
  // Back-compat / convenience.
  writeFile(path.resolve(RESOURCES_DIR, "desktop.prepared.txt"), stamp);
  process.stdout.write(
    `[propai-desktop] Bundle prepared at ${path.relative(REPO_ROOT, RESOURCES_DIR)}\n`,
  );
}

try {
  main();
} catch (err) {
  fail(err && typeof err === "object" && "message" in err ? String(err.message) : String(err));
}






