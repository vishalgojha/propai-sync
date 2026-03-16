import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "propai",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "propai", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "propai", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "propai", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "propai", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "propai", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "propai", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "propai", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "propai", "--profile", "work", "--dev", "status"]],
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
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".propai-dev");
    expect(env.propai_PROFILE).toBe("dev");
    expect(env.propai_STATE_DIR).toBe(expectedStateDir);
    expect(env.propai_CONFIG_PATH).toBe(path.join(expectedStateDir, "propai.json"));
    expect(env.propai_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      PROPAI_STATE_DIR: "/custom",
      PROPAI_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.propai_STATE_DIR).toBe("/custom");
    expect(env.propai_GATEWAY_PORT).toBe("19099");
    expect(env.propai_CONFIG_PATH).toBe(path.join("/custom", "propai.json"));
  });

  it("uses PROPAI_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      PROPAI_HOME: "/srv/propai-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/propai-home");
    expect(env.propai_STATE_DIR).toBe(path.join(resolvedHome, ".propai-work"));
    expect(env.propai_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".propai-work", "propai.json"),
    );
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "propai doctor --fix",
      env: {},
      expected: "propai doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "propai doctor --fix",
      env: { PROPAI_PROFILE: "default" },
      expected: "propai doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "propai doctor --fix",
      env: { PROPAI_PROFILE: "Default" },
      expected: "propai doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "propai doctor --fix",
      env: { PROPAI_PROFILE: "bad profile" },
      expected: "propai doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "propai --profile work doctor --fix",
      env: { PROPAI_PROFILE: "work" },
      expected: "propai --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "propai --dev doctor",
      env: { PROPAI_PROFILE: "dev" },
      expected: "propai --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("propai doctor --fix", { PROPAI_PROFILE: "work" })).toBe(
      "propai --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("propai doctor --fix", { PROPAI_PROFILE: "  jbPropAiSync  " })).toBe(
      "propai --profile jbPropAiSync doctor --fix",
    );
  });

  it("handles command with no args after legacy name", () => {
    expect(formatCliCommand("propai", { PROPAI_PROFILE: "test" })).toBe(
      "propai --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm propai doctor", { PROPAI_PROFILE: "work" })).toBe(
      "pnpm propai --profile work doctor",
    );
  });
});
