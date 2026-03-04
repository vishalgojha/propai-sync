import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "openclaw",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "openclaw", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "openclaw", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "openclaw", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "openclaw", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "openclaw", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "openclaw", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "openclaw", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "openclaw", "--profile", "work", "--dev", "status"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".propaiclaw-dev");
    expect(env.PROPAICLAW_PROFILE).toBe("dev");
    expect(env.PROPAICLAW_STATE_DIR).toBe(expectedStateDir);
    expect(env.PROPAICLAW_CONFIG_PATH).toBe(path.join(expectedStateDir, "propaiclaw.json"));
    expect(env.PROPAICLAW_PROFILE).toBeUndefined();
    expect(env.PROPAICLAW_STATE_DIR).toBeUndefined();
    expect(env.PROPAICLAW_CONFIG_PATH).toBeUndefined();
    expect(env.PROPAICLAW_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      PROPAICLAW_STATE_DIR: "/custom",
      PROPAICLAW_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.PROPAICLAW_STATE_DIR).toBe("/custom");
    expect(env.PROPAICLAW_GATEWAY_PORT).toBe("19099");
    expect(env.PROPAICLAW_CONFIG_PATH).toBe(path.join("/custom", "propaiclaw.json"));
  });

  it("does not backfill PROPAICLAW_GATEWAY_PORT from PROPAICLAW_GATEWAY_PORT in dev profile", () => {
    const env: Record<string, string | undefined> = {
      PROPAICLAW_GATEWAY_PORT: "19111",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.PROPAICLAW_GATEWAY_PORT).toBe("19111");
    expect(env.PROPAICLAW_GATEWAY_PORT).toBeUndefined();
  });

  it("uses PROPAICLAW_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      PROPAICLAW_HOME: "/srv/openclaw-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/openclaw-home");
    expect(env.PROPAICLAW_STATE_DIR).toBe(path.join(resolvedHome, ".propaiclaw-work"));
    expect(env.PROPAICLAW_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".propaiclaw-work", "propaiclaw.json"),
    );
  });

  it("uses propaiclaw canonical dirs/files regardless of mode flag", () => {
    const env: Record<string, string | undefined> = {
      PROPAICLAW_MODE: "1",
      PROPAICLAW_HOME: "/srv/propaiclaw-home",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/propaiclaw-home");
    expect(env.PROPAICLAW_PROFILE).toBe("work");
    expect(env.PROPAICLAW_STATE_DIR).toBe(path.join(resolvedHome, ".propaiclaw-work"));
    expect(env.PROPAICLAW_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".propaiclaw-work", "propaiclaw.json"),
    );
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "openclaw doctor --fix",
      env: {},
      expected: "openclaw doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "openclaw doctor --fix",
      env: { PROPAICLAW_PROFILE: "default" },
      expected: "openclaw doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "openclaw doctor --fix",
      env: { PROPAICLAW_PROFILE: "Default" },
      expected: "openclaw doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "openclaw doctor --fix",
      env: { PROPAICLAW_PROFILE: "bad profile" },
      expected: "openclaw doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "openclaw --profile work doctor --fix",
      env: { PROPAICLAW_PROFILE: "work" },
      expected: "openclaw --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "openclaw --dev doctor",
      env: { PROPAICLAW_PROFILE: "dev" },
      expected: "openclaw --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("openclaw doctor --fix", { PROPAICLAW_PROFILE: "work" })).toBe(
      "openclaw --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(
      formatCliCommand("openclaw doctor --fix", { PROPAICLAW_PROFILE: "  jbopenclaw  " }),
    ).toBe("openclaw --profile jbopenclaw doctor --fix");
  });

  it("handles command with no args after openclaw", () => {
    expect(formatCliCommand("openclaw", { PROPAICLAW_PROFILE: "test" })).toBe(
      "openclaw --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm openclaw doctor", { PROPAICLAW_PROFILE: "work" })).toBe(
      "pnpm openclaw --profile work doctor",
    );
  });
});
