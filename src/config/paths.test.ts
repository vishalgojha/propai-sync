import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GATEWAY_PORT,
  resolveDefaultConfigCandidates,
  resolveConfigPathCandidate,
  resolveConfigPath,
  resolveGatewayPort,
  resolveOAuthDir,
  resolveOAuthPath,
  resolveStateDir,
  resolveStateDirForWrite,
} from "./paths.js";

describe("oauth paths", () => {
  it("uses PROPAICLAW_OAUTH_DIR when set", () => {
    const env = {
      PROPAICLAW_OAUTH_DIR: "/custom/propaiclaw-oauth",
      PROPAICLAW_STATE_DIR: "/custom/state",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.resolve("/custom/propaiclaw-oauth"));
  });

  it("derives from state dir when PROPAICLAW_OAUTH_DIR is unset", () => {
    const env = {
      PROPAICLAW_STATE_DIR: "/custom/state",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.join("/custom/state", "credentials"));
    expect(resolveOAuthPath(env, "/custom/state")).toBe(
      path.join("/custom/state", "credentials", "oauth.json"),
    );
  });

  it("derives oauth path from PROPAICLAW_STATE_DIR when unset", () => {
    const env = {
      PROPAICLAW_STATE_DIR: "/custom/state",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.join("/custom/state", "credentials"));
    expect(resolveOAuthPath(env, "/custom/state")).toBe(
      path.join("/custom/state", "credentials", "oauth.json"),
    );
  });
});

describe("state + config path candidates", () => {
  async function withTempRoot(prefix: string, run: (root: string) => Promise<void>): Promise<void> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    try {
      await run(root);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }

  function expectPropaiclawHomeDefaults(env: NodeJS.ProcessEnv): void {
    const configuredHome = env.PROPAICLAW_HOME;
    if (!configuredHome) {
      throw new Error("PROPAICLAW_HOME must be set for this assertion helper");
    }
    const resolvedHome = path.resolve(configuredHome);
    expect(resolveStateDir(env)).toBe(path.join(resolvedHome, ".openclaw"));

    const candidates = resolveDefaultConfigCandidates(env);
    expect(candidates[0]).toBe(path.join(resolvedHome, ".openclaw", "openclaw.json"));
  }

  function expectPropaiclawModeHomeDefaults(env: NodeJS.ProcessEnv): void {
    const configuredHome = env.PROPAICLAW_HOME;
    if (!configuredHome) {
      throw new Error("PROPAICLAW_HOME must be set for this assertion helper");
    }
    const resolvedHome = path.resolve(configuredHome);
    expect(resolveStateDir(env)).toBe(path.join(resolvedHome, ".propaiclaw"));

    const candidates = resolveDefaultConfigCandidates(env);
    expect(candidates[0]).toBe(path.join(resolvedHome, ".propaiclaw", "propaiclaw.json"));
    expect(candidates[1]).toBe(path.join(resolvedHome, ".propaiclaw", "openclaw.json"));
  }

  it("uses PROPAICLAW_STATE_DIR when set", () => {
    const env = {
      PROPAICLAW_STATE_DIR: "/new/state",
    } as NodeJS.ProcessEnv;

    expect(resolveStateDir(env, () => "/home/test")).toBe(path.resolve("/new/state"));
  });

  it("uses HOME defaults when state override is unset", () => {
    const env = {} as NodeJS.ProcessEnv;
    expect(resolveStateDir(env, () => "/home/test")).toBe(path.resolve("/home/test", ".openclaw"));
  });

  it("ignores removed CLAWDBOT_STATE_DIR override", () => {
    const env = {
      CLAWDBOT_STATE_DIR: "/legacy/state",
    } as NodeJS.ProcessEnv;
    expect(resolveStateDir(env, () => "/home/test")).toBe(path.resolve("/home/test", ".openclaw"));
  });

  it("uses PROPAICLAW_HOME for default state/config locations", () => {
    const env = {
      PROPAICLAW_HOME: "/srv/propaiclaw-home",
    } as NodeJS.ProcessEnv;
    expectPropaiclawHomeDefaults(env);
  });

  it("falls back to HOME when PROPAICLAW_HOME is unset", () => {
    const env = {
      HOME: "/home/other",
    } as NodeJS.ProcessEnv;
    expect(resolveStateDir(env)).toBe(path.join(path.resolve("/home/other"), ".openclaw"));
  });

  it("uses PROPAICLAW_HOME + PROPAICLAW_MODE for canonical propaiclaw defaults", () => {
    const env = {
      PROPAICLAW_HOME: "/srv/propaiclaw-home",
      PROPAICLAW_MODE: "1",
    } as NodeJS.ProcessEnv;
    expectPropaiclawModeHomeDefaults(env);
  });

  it("orders default config candidates in a stable order", () => {
    const home = "/home/test";
    const resolvedHome = path.resolve(home);
    const candidates = resolveDefaultConfigCandidates({} as NodeJS.ProcessEnv, () => home);
    const expected = [
      path.join(resolvedHome, ".openclaw", "openclaw.json"),
      path.join(resolvedHome, ".openclaw", "clawdbot.json"),
      path.join(resolvedHome, ".openclaw", "moldbot.json"),
      path.join(resolvedHome, ".openclaw", "moltbot.json"),
      path.join(resolvedHome, ".clawdbot", "openclaw.json"),
      path.join(resolvedHome, ".clawdbot", "clawdbot.json"),
      path.join(resolvedHome, ".clawdbot", "moldbot.json"),
      path.join(resolvedHome, ".clawdbot", "moltbot.json"),
      path.join(resolvedHome, ".moldbot", "openclaw.json"),
      path.join(resolvedHome, ".moldbot", "clawdbot.json"),
      path.join(resolvedHome, ".moldbot", "moldbot.json"),
      path.join(resolvedHome, ".moldbot", "moltbot.json"),
      path.join(resolvedHome, ".moltbot", "openclaw.json"),
      path.join(resolvedHome, ".moltbot", "clawdbot.json"),
      path.join(resolvedHome, ".moltbot", "moldbot.json"),
      path.join(resolvedHome, ".moltbot", "moltbot.json"),
    ];
    expect(candidates).toEqual(expected);
  });

  it("prefers ~/.openclaw when it exists and legacy dir is missing", async () => {
    await withTempRoot("openclaw-state-", async (root) => {
      const newDir = path.join(root, ".openclaw");
      await fs.mkdir(newDir, { recursive: true });
      const resolved = resolveStateDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("falls back to existing legacy state dir when ~/.openclaw is missing", async () => {
    await withTempRoot("openclaw-state-legacy-", async (root) => {
      const legacyDir = path.join(root, ".clawdbot");
      await fs.mkdir(legacyDir, { recursive: true });
      const resolved = resolveStateDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(legacyDir);
    });
  });

  it("in propaiclaw mode, falls back to existing ~/.openclaw when ~/.propaiclaw is missing", async () => {
    await withTempRoot("propaiclaw-state-legacy-", async (root) => {
      const legacyDir = path.join(root, ".openclaw");
      await fs.mkdir(legacyDir, { recursive: true });
      const resolved = resolveStateDir({ PROPAICLAW_MODE: "1" } as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(legacyDir);
    });
  });

  it("in propaiclaw mode, write state dir remains canonical even when legacy state exists", async () => {
    await withTempRoot("propaiclaw-state-write-", async (root) => {
      const legacyDir = path.join(root, ".openclaw");
      await fs.mkdir(legacyDir, { recursive: true });
      const resolved = resolveStateDirForWrite(
        { PROPAICLAW_MODE: "1" } as NodeJS.ProcessEnv,
        () => root,
      );
      expect(resolved).toBe(path.join(root, ".propaiclaw"));
    });
  });

  it("CONFIG_PATH prefers existing config when present", async () => {
    await withTempRoot("openclaw-config-", async (root) => {
      const legacyDir = path.join(root, ".openclaw");
      await fs.mkdir(legacyDir, { recursive: true });
      const legacyPath = path.join(legacyDir, "openclaw.json");
      await fs.writeFile(legacyPath, "{}", "utf-8");

      const resolved = resolveConfigPathCandidate({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(legacyPath);
    });
  });

  it("respects state dir overrides when config is missing", async () => {
    await withTempRoot("openclaw-config-override-", async (root) => {
      const legacyDir = path.join(root, ".openclaw");
      await fs.mkdir(legacyDir, { recursive: true });
      const legacyConfig = path.join(legacyDir, "openclaw.json");
      await fs.writeFile(legacyConfig, "{}", "utf-8");

      const overrideDir = path.join(root, "override");
      const env = { PROPAICLAW_STATE_DIR: overrideDir } as NodeJS.ProcessEnv;
      const resolved = resolveConfigPath(env, overrideDir, () => root);
      expect(resolved).toBe(path.join(overrideDir, "openclaw.json"));
    });
  });

  it("in propaiclaw mode, prefers existing openclaw config before canonical fallback", async () => {
    await withTempRoot("propaiclaw-config-candidate-", async (root) => {
      const legacyDir = path.join(root, ".openclaw");
      await fs.mkdir(legacyDir, { recursive: true });
      const legacyConfig = path.join(legacyDir, "openclaw.json");
      await fs.writeFile(legacyConfig, "{}", "utf-8");

      const resolved = resolveConfigPathCandidate(
        { PROPAICLAW_MODE: "1" } as NodeJS.ProcessEnv,
        () => root,
      );
      expect(resolved).toBe(legacyConfig);
    });
  });

  it("ignores removed CLAWDBOT_GATEWAY_PORT override", () => {
    const env = {
      CLAWDBOT_GATEWAY_PORT: "19001",
    } as NodeJS.ProcessEnv;
    expect(resolveGatewayPort({}, env)).toBe(DEFAULT_GATEWAY_PORT);
  });
});
