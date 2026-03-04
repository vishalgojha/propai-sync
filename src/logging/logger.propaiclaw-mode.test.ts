import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("logger propaiclaw mode defaults", () => {
  it("uses propaiclaw-prefixed log filenames in propaiclaw mode", async () => {
    vi.stubEnv("PROPAICLAW_MODE", "1");
    vi.resetModules();
    const logger = await import("./logger.js");

    expect(logger.DEFAULT_LOG_FILE.toLowerCase()).toContain("propaiclaw");
    expect(logger.getResolvedLoggerSettings().file.toLowerCase()).toContain("propaiclaw-");
  });
});

