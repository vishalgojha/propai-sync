#!/usr/bin/env node

import fs from "node:fs";
import module from "node:module";
import { fileURLToPath } from "node:url";

const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 12;
const MIN_NODE_VERSION = `${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}`;

const parseNodeVersion = (rawVersion) => {
  const [majorRaw = "0", minorRaw = "0"] = rawVersion.split(".");
  return {
    major: Number(majorRaw),
    minor: Number(minorRaw),
  };
};

const isSupportedNodeVersion = (version) =>
  version.major > MIN_NODE_MAJOR ||
  (version.major === MIN_NODE_MAJOR && version.minor >= MIN_NODE_MINOR);

const ensureSupportedNodeVersion = () => {
  if (isSupportedNodeVersion(parseNodeVersion(process.versions.node))) {
    return;
  }

  process.stderr.write(
    `PropAi Sync: Node.js v${MIN_NODE_VERSION}+ is required (current: v${process.versions.node}).\n` +
      "If you use nvm, run:\n" +
      `  nvm install ${MIN_NODE_MAJOR}\n` +
      `  nvm use ${MIN_NODE_MAJOR}\n` +
      `  nvm alias default ${MIN_NODE_MAJOR}\n`,
  );
  process.exit(1);
};

ensureSupportedNodeVersion();

// https://nodejs.org/api/module.html#module-compile-cache
if (module.enableCompileCache && !process.env.NODE_DISABLE_COMPILE_CACHE) {
  try {
    module.enableCompileCache();
  } catch {
    // Ignore errors
  }
}

const isModuleNotFoundError = (err) =>
  err && typeof err === "object" && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";

const isMissingSelf = (err, specifierUrl) =>
  isModuleNotFoundError(err) && err && typeof err === "object" && "url" in err && err.url === specifierUrl;

const resolveDistPath = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const resolveDistUrl = (rel) => new URL(rel, import.meta.url).href;

const installProcessWarningFilter = async () => {
  // Keep bootstrap warnings consistent with the TypeScript runtime.
  for (const specifier of ["./dist/warning-filter.js", "./dist/warning-filter.mjs"]) {
    const specifierPath = resolveDistPath(specifier);
    if (!fs.existsSync(specifierPath)) {
      continue;
    }
    try {
      const mod = await import(resolveDistUrl(specifier));
      if (typeof mod.installProcessWarningFilter === "function") {
        mod.installProcessWarningFilter();
        return;
      }
    } catch (err) {
      // Only swallow "missing file" errors for this exact specifier.
      if (isMissingSelf(err, resolveDistUrl(specifier))) {
        continue;
      }
      throw err;
    }
  }
};

await installProcessWarningFilter();

const tryImport = async (specifier) => {
  const specifierPath = resolveDistPath(specifier);
  if (!fs.existsSync(specifierPath)) {
    return false;
  }

  const specifierUrl = resolveDistUrl(specifier);
  try {
    await import(specifierUrl);
    return true;
  } catch (err) {
    // Only swallow "missing file" errors for this exact specifier; rethrow
    // missing-dependency errors so we don't hide the real root cause.
    if (isMissingSelf(err, specifierUrl)) {
      return false;
    }
    throw err;
  }
};

if (await tryImport("./dist/entry.js")) {
  // OK
} else if (await tryImport("./dist/entry.mjs")) {
  // OK
} else {
  const basePath = fileURLToPath(import.meta.url);
  const candidates = ["./dist/entry.js", "./dist/entry.mjs"].map((rel) => ({
    rel,
    path: resolveDistPath(rel),
    exists: fs.existsSync(resolveDistPath(rel)),
  }));
  throw new Error(
    [
      "PropAi Sync: missing dist/entry.(m)js (build output).",
      "PropAi Sync: desktop debug info:",
      `- import.meta.url: ${import.meta.url}`,
      `- basePath: ${basePath}`,
      `- cwd: ${process.cwd()}`,
      `- candidates: ${JSON.stringify(candidates)}`,
    ].join("\n"),
  );
}

