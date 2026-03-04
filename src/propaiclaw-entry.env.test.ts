import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyProcessEnvValues, resolvePropaiclawRuntimeEnv } from "./propaiclaw-entry.env.js";

describe("propaiclaw runtime env bootstrap", () => {
  it("enables propaiclaw mode and whatsapp channel default", () => {
    const resolved = resolvePropaiclawRuntimeEnv({} as NodeJS.ProcessEnv);
    expect(resolved.PROPAICLAW_MODE).toBe("1");
    expect(resolved.PROPAICLAW_CHANNELS_ONLY).toBe("whatsapp");
    expect(resolved.OPENCLAW_HIDE_BANNER).toBe("1");
  });

  it("keeps canonical propaiclaw env values", () => {
    const resolved = resolvePropaiclawRuntimeEnv({
      PROPAICLAW_STATE_DIR: "/canonical/state",
      PROPAICLAW_CONFIG_PATH: "/canonical/propaiclaw.json",
      PROPAICLAW_HOME: "/canonical/home",
      PROPAICLAW_PROFILE: "tenant-a",
      PROPAICLAW_OAUTH_DIR: "/canonical/oauth",
      PROPAICLAW_ROOT: "/canonical/root",
    } as NodeJS.ProcessEnv);
    expect(resolved.PROPAICLAW_STATE_DIR).toBe("/canonical/state");
    expect(resolved.PROPAICLAW_CONFIG_PATH).toBe("/canonical/propaiclaw.json");
    expect(resolved.PROPAICLAW_HOME).toBe("/canonical/home");
    expect(resolved.PROPAICLAW_PROFILE).toBe("tenant-a");
    expect(resolved.PROPAICLAW_OAUTH_DIR).toBe("/canonical/oauth");
    expect(resolved.PROPAICLAW_ROOT).toBe("/canonical/root");
  });

  it("does not backfill canonical aliases from unrelated runtime env values", () => {
    const resolved = resolvePropaiclawRuntimeEnv({
      LEGACY_HOME: "/legacy/home",
      LEGACY_OAUTH_DIR: "/legacy/oauth",
      LEGACY_PROFILE: "tenant-a",
    } as NodeJS.ProcessEnv);
    expect(resolved.PROPAICLAW_HOME).toBeUndefined();
    expect(resolved.PROPAICLAW_OAUTH_DIR).toBeUndefined();
    expect(resolved.PROPAICLAW_PROFILE).toBeUndefined();
    expect(resolved.LEGACY_HOME).toBe("/legacy/home");
    expect(resolved.LEGACY_OAUTH_DIR).toBe("/legacy/oauth");
    expect(resolved.LEGACY_PROFILE).toBe("tenant-a");
  });

  it("falls back to legacy ~/.openclaw state dir when canonical dir is not present", () => {
    const homeDir = path.join(path.sep, "users", "visha");
    const legacyDir = path.join(homeDir, ".openclaw");
    const resolved = resolvePropaiclawRuntimeEnv(
      {
        HOME: homeDir,
      } as NodeJS.ProcessEnv,
      {
        homedir: () => homeDir,
        existsSync: (targetPath) => targetPath === legacyDir,
      },
    );
    expect(resolved.PROPAICLAW_STATE_DIR).toBe(legacyDir);
  });

  it("does not force legacy fallback when canonical ~/.propaiclaw exists", () => {
    const homeDir = path.join(path.sep, "users", "visha");
    const legacyDir = path.join(homeDir, ".openclaw");
    const canonicalDir = path.join(homeDir, ".propaiclaw");
    const resolved = resolvePropaiclawRuntimeEnv(
      {
        HOME: homeDir,
      } as NodeJS.ProcessEnv,
      {
        homedir: () => homeDir,
        existsSync: (targetPath) =>
          targetPath === canonicalDir || targetPath === legacyDir,
      },
    );
    expect(resolved.PROPAICLAW_STATE_DIR).toBeUndefined();
  });

  it("applies resolved env values onto process-like env target", () => {
    const target = {} as NodeJS.ProcessEnv;
    const source = resolvePropaiclawRuntimeEnv({
      PROPAICLAW_GATEWAY_PORT: "18790",
    } as NodeJS.ProcessEnv);
    applyProcessEnvValues(source, target);
    expect(target.PROPAICLAW_GATEWAY_PORT).toBe("18790");
    expect(target.PROPAICLAW_MODE).toBe("1");
  });

  it("preserves explicit banner visibility preference", () => {
    const resolved = resolvePropaiclawRuntimeEnv({
      OPENCLAW_HIDE_BANNER: "0",
    } as NodeJS.ProcessEnv);
    expect(resolved.OPENCLAW_HIDE_BANNER).toBe("0");
  });
});
