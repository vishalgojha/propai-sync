import { describe, expect, it } from "vitest";
import { theme } from "../../terminal/theme.js";
import { filterDaemonEnv, resolveRuntimeStatusColor } from "./shared.js";

describe("resolveRuntimeStatusColor", () => {
  it("maps known runtime states to expected theme colors", () => {
    expect(resolveRuntimeStatusColor("running")).toBe(theme.success);
    expect(resolveRuntimeStatusColor("stopped")).toBe(theme.error);
    expect(resolveRuntimeStatusColor("unknown")).toBe(theme.muted);
  });

  it("falls back to warning color for unexpected states", () => {
    expect(resolveRuntimeStatusColor("degraded")).toBe(theme.warn);
    expect(resolveRuntimeStatusColor(undefined)).toBe(theme.muted);
  });
});

describe("filterDaemonEnv", () => {
  it("returns canonical profile/state/config values", () => {
    expect(
      filterDaemonEnv({
        PROPAICLAW_PROFILE: "work",
        PROPAICLAW_STATE_DIR: "/srv/propaiclaw",
        PROPAICLAW_CONFIG_PATH: "/srv/propaiclaw/propaiclaw.json",
        PROPAICLAW_GATEWAY_PORT: "19001",
        OPENCLAW_NIX_MODE: "1",
      }),
    ).toEqual({
      PROPAICLAW_PROFILE: "work",
      PROPAICLAW_STATE_DIR: "/srv/propaiclaw",
      PROPAICLAW_CONFIG_PATH: "/srv/propaiclaw/propaiclaw.json",
      PROPAICLAW_GATEWAY_PORT: "19001",
      OPENCLAW_NIX_MODE: "1",
    });
  });
});
