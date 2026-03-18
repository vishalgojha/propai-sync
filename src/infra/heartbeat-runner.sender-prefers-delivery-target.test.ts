import { describe, expect, it, vi } from "vitest";
import type { PropAiSyncConfig } from "../config/config.js";
import { runHeartbeatOnce } from "./heartbeat-runner.js";
import { installHeartbeatRunnerTestRuntime } from "./heartbeat-runner.test-harness.js";
import { seedMainSessionStore, withTempHeartbeatSandbox } from "./heartbeat-runner.test-utils.js";

// Avoid pulling optional runtime deps during isolated runs.
vi.mock("jiti", () => ({ createJiti: () => () => ({}) }));

installHeartbeatRunnerTestRuntime();

describe("runHeartbeatOnce", () => {
  it("uses the delivery target as sender when lastTo differs", async () => {
    await withTempHeartbeatSandbox(
      async ({ tmpDir, storePath, replySpy }) => {
        const cfg: PropAiSyncConfig = {
          agents: {
            defaults: {
              workspace: tmpDir,
              heartbeat: {
                every: "5m",
                target: "telegram",
                to: "123456",
              },
            },
          },
          session: { store: storePath },
        };

        await seedMainSessionStore(storePath, cfg, {
          lastChannel: "telegram",
          lastProvider: "telegram",
          lastTo: "1644620762",
        });

        replySpy.mockImplementation(async (ctx: { To?: string; From?: string }) => {
          expect(ctx.To).toBe("123456");
          expect(ctx.From).toBe("123456");
          return { text: "ok" };
        });

        const sendTelegram = vi.fn().mockResolvedValue({
          messageId: "m1",
          chatId: "123456",
        });

        await runHeartbeatOnce({
          cfg,
          deps: {
            sendTelegram,
            getQueueSize: () => 0,
            nowMs: () => 0,
          },
        });

        expect(sendTelegram).toHaveBeenCalled();
      },
      { prefix: "propai-hb-" },
    );
  });
});



