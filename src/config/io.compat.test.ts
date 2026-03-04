import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createConfigIO } from "./io.js";

async function withTempHome(run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-config-"));
  try {
    await run(home);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
}

async function writeConfig(
  home: string,
  dirname: ".openclaw",
  port: number,
  filename: string = "openclaw.json",
) {
  const dir = path.join(home, dirname);
  await fs.mkdir(dir, { recursive: true });
  const configPath = path.join(dir, filename);
  await fs.writeFile(configPath, JSON.stringify({ gateway: { port } }, null, 2));
  return configPath;
}

function createIoForHome(home: string, env: NodeJS.ProcessEnv = {} as NodeJS.ProcessEnv) {
  return createConfigIO({
    env,
    homedir: () => home,
  });
}

describe("config io paths", () => {
  it("uses ~/.openclaw/openclaw.json when config exists", async () => {
    await withTempHome(async (home) => {
      const configPath = await writeConfig(home, ".openclaw", 19001);
      const io = createIoForHome(home);
      expect(io.configPath).toBe(configPath);
      expect(io.loadConfig().gateway?.port).toBe(19001);
    });
  });

  it("defaults to ~/.openclaw/openclaw.json when config is missing", async () => {
    await withTempHome(async (home) => {
      const io = createIoForHome(home);
      expect(io.configPath).toBe(path.join(home, ".openclaw", "openclaw.json"));
    });
  });

  it("uses PROPAICLAW_HOME for default config path", async () => {
    await withTempHome(async (home) => {
      const io = createConfigIO({
        env: { PROPAICLAW_HOME: path.join(home, "svc-home") } as NodeJS.ProcessEnv,
        homedir: () => path.join(home, "ignored-home"),
      });
      expect(io.configPath).toBe(path.join(home, "svc-home", ".openclaw", "openclaw.json"));
    });
  });

  it("honors explicit PROPAICLAW_CONFIG_PATH override", async () => {
    await withTempHome(async (home) => {
      const customPath = await writeConfig(home, ".openclaw", 20002, "custom.json");
      const io = createIoForHome(home, { PROPAICLAW_CONFIG_PATH: customPath } as NodeJS.ProcessEnv);
      expect(io.configPath).toBe(customPath);
      expect(io.loadConfig().gateway?.port).toBe(20002);
    });
  });

  it("ignores removed CLAWDBOT_CONFIG_PATH override", async () => {
    await withTempHome(async (home) => {
      const customPath = await writeConfig(home, ".openclaw", 20003, "legacy-custom.json");
      const defaultPath = await writeConfig(home, ".openclaw", 20004, "openclaw.json");
      const io = createIoForHome(home, { CLAWDBOT_CONFIG_PATH: customPath } as NodeJS.ProcessEnv);
      expect(io.configPath).toBe(defaultPath);
      expect(io.loadConfig().gateway?.port).toBe(20004);
    });
  });

  it("normalizes safe-bin config entries at config load time", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".openclaw");
      await fs.mkdir(configDir, { recursive: true });
      const configPath = path.join(configDir, "openclaw.json");
      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            tools: {
              exec: {
                safeBinTrustedDirs: [" /custom/bin ", "", "/custom/bin", "/agent/bin"],
                safeBinProfiles: {
                  " MyFilter ": {
                    allowedValueFlags: ["--limit", " --limit ", ""],
                  },
                },
              },
            },
            agents: {
              list: [
                {
                  id: "ops",
                  tools: {
                    exec: {
                      safeBinTrustedDirs: [" /ops/bin ", "/ops/bin"],
                      safeBinProfiles: {
                        " Custom ": {
                          deniedFlags: ["-f", " -f ", ""],
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
          null,
          2,
        ),
        "utf-8",
      );
      const io = createIoForHome(home);
      expect(io.configPath).toBe(configPath);
      const cfg = io.loadConfig();
      expect(cfg.tools?.exec?.safeBinProfiles).toEqual({
        myfilter: {
          allowedValueFlags: ["--limit"],
        },
      });
      expect(cfg.tools?.exec?.safeBinTrustedDirs).toEqual(["/custom/bin", "/agent/bin"]);
      expect(cfg.agents?.list?.[0]?.tools?.exec?.safeBinProfiles).toEqual({
        custom: {
          deniedFlags: ["-f"],
        },
      });
      expect(cfg.agents?.list?.[0]?.tools?.exec?.safeBinTrustedDirs).toEqual(["/ops/bin"]);
    });
  });

  it("reads legacy config but writes canonical config in propaiclaw mode", async () => {
    await withTempHome(async (home) => {
      const legacyPath = await writeConfig(home, ".openclaw", 20111);
      const io = createIoForHome(home, { PROPAICLAW_MODE: "1" } as NodeJS.ProcessEnv);

      // Dual-read: existing legacy config is still discovered for loading.
      expect(io.configPath).toBe(legacyPath);
      const loaded = io.loadConfig();
      expect(loaded.gateway?.port).toBe(20111);

      // Single-write: writes move to canonical propaiclaw namespace.
      await io.writeConfigFile({
        ...loaded,
        gateway: {
          ...loaded.gateway,
          port: 20112,
        },
      });

      const canonicalPath = path.join(home, ".propaiclaw", "propaiclaw.json");
      const canonical = JSON.parse(await fs.readFile(canonicalPath, "utf-8")) as {
        gateway?: { port?: number };
      };
      expect(canonical.gateway?.port).toBe(20112);

      const legacy = JSON.parse(await fs.readFile(legacyPath, "utf-8")) as {
        gateway?: { port?: number };
      };
      expect(legacy.gateway?.port).toBe(20111);
    });
  });
});
