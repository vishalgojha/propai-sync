import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          PROPAI_STATE_DIR: "/tmp/propai-state",
          PROPAI_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "propai-gateway",
        windowsTaskName: "PropAi Sync Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/propai-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/propai-state/logs/gateway.err.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        systemdServiceName: "propai-gateway",
        windowsTaskName: "PropAi Sync Gateway",
      }),
    ).toEqual(["Logs: journalctl --user -u propai-gateway.service -n 200 --no-pager"]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        systemdServiceName: "propai-gateway",
        windowsTaskName: "PropAi Sync Gateway",
      }),
    ).toEqual(['Logs: schtasks /Query /TN "PropAi Sync Gateway" /V /FO LIST']);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "PropAi Sync gateway install",
        startCommand: "PropAi Sync gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.propai.gateway.plist",
        systemdServiceName: "propai-gateway",
        windowsTaskName: "PropAi Sync Gateway",
      }),
    ).toEqual([
      "PropAi Sync gateway install",
      "PropAi Sync gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.propai.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "PropAi Sync gateway install",
        startCommand: "PropAi Sync gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.propai.gateway.plist",
        systemdServiceName: "propai-gateway",
        windowsTaskName: "PropAi Sync Gateway",
      }),
    ).toEqual([
      "PropAi Sync gateway install",
      "PropAi Sync gateway",
      "systemctl --user start propai-gateway.service",
    ]);
  });
});


