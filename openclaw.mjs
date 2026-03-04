#!/usr/bin/env node

import module from "node:module";

const compileCacheOptIn =
  process.env.OPENCLAW_ENABLE_COMPILE_CACHE === "1" ||
  process.env.PROPAICLAW_ENABLE_COMPILE_CACHE === "1";

// https://nodejs.org/api/module.html#module-compile-cache
// Disable by default on Windows to avoid stale hashed dist chunk imports after rebuilds.
const shouldEnableCompileCache =
  module.enableCompileCache &&
  !process.env.NODE_DISABLE_COMPILE_CACHE &&
  (process.platform !== "win32" || compileCacheOptIn);

if (shouldEnableCompileCache) {
  try {
    module.enableCompileCache();
  } catch {
    // Ignore errors
  }
}

const isModuleNotFoundError = (err) =>
  err && typeof err === "object" && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";

const installProcessWarningFilter = async () => {
  // Keep bootstrap warnings consistent with the TypeScript runtime.
  for (const specifier of ["./dist/warning-filter.js", "./dist/warning-filter.mjs"]) {
    try {
      const mod = await import(specifier);
      if (typeof mod.installProcessWarningFilter === "function") {
        mod.installProcessWarningFilter();
        return;
      }
    } catch (err) {
      if (isModuleNotFoundError(err)) {
        continue;
      }
      throw err;
    }
  }
};

await installProcessWarningFilter();

const tryImport = async (specifier) => {
  try {
    await import(specifier);
    return true;
  } catch (err) {
    // Only swallow missing-module errors; rethrow real runtime errors.
    if (isModuleNotFoundError(err)) {
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
  throw new Error("openclaw: missing dist/entry.(m)js (build output).");
}
