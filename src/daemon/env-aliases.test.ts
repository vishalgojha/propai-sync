import { describe, expect, it } from "vitest";
import {
  resolveDaemonLaunchdLabelEnv,
  resolveDaemonLogPrefixEnv,
  resolveDaemonServiceVersionEnv,
  resolveDaemonSystemdUnitEnv,
  resolveDaemonTaskScriptEnv,
  resolveDaemonTaskScriptNameEnv,
  resolveDaemonWindowsTaskNameEnv,
  resolveDaemonConfigPathEnv,
  resolveDaemonProfileEnv,
  resolveDaemonStateDirEnv,
} from "./env-aliases.js";

describe("daemon env aliases", () => {
  it("resolves canonical PROPAICLAW profile", () => {
    expect(
      resolveDaemonProfileEnv({
        PROPAICLAW_PROFILE: "work",
      }),
    ).toBe("work");
  });

  it("does not fallback to legacy OPENCLAW profile when canonical is unset", () => {
    expect(
      resolveDaemonProfileEnv({
        PROPAICLAW_PROFILE: "legacy",
      }),
    ).toBeUndefined();
  });

  it("resolves state/config from canonical aliases", () => {
    const env = {
      PROPAICLAW_STATE_DIR: "/srv/propaiclaw",
      PROPAICLAW_CONFIG_PATH: "/srv/propaiclaw/propaiclaw.json",
    };
    expect(resolveDaemonStateDirEnv(env)).toBe("/srv/propaiclaw");
    expect(resolveDaemonConfigPathEnv(env)).toBe("/srv/propaiclaw/propaiclaw.json");
  });

  it("does not fallback to OPENCLAW state/config aliases", () => {
    const env = {
      PROPAICLAW_STATE_DIR: "/srv/openclaw",
      PROPAICLAW_CONFIG_PATH: "/srv/openclaw/openclaw.json",
    };
    expect(resolveDaemonStateDirEnv(env)).toBeUndefined();
    expect(resolveDaemonConfigPathEnv(env)).toBeUndefined();
  });

  it("resolves internal service keys from canonical PROPAICLAW env values", () => {
    const env = {
      PROPAICLAW_LAUNCHD_LABEL: "ai.propaiclaw.gateway",
      PROPAICLAW_SYSTEMD_UNIT: "propaiclaw-gateway",
      PROPAICLAW_WINDOWS_TASK_NAME: "PropAI Gateway",
      PROPAICLAW_TASK_SCRIPT: "C:\\PropAI\\gateway.cmd",
      PROPAICLAW_TASK_SCRIPT_NAME: "propai-gateway.cmd",
      PROPAICLAW_LOG_PREFIX: "propai",
      PROPAICLAW_SERVICE_VERSION: "2.0.0",
    };
    expect(resolveDaemonLaunchdLabelEnv(env)).toBe("ai.propaiclaw.gateway");
    expect(resolveDaemonSystemdUnitEnv(env)).toBe("propaiclaw-gateway");
    expect(resolveDaemonWindowsTaskNameEnv(env)).toBe("PropAI Gateway");
    expect(resolveDaemonTaskScriptEnv(env)).toBe("C:\\PropAI\\gateway.cmd");
    expect(resolveDaemonTaskScriptNameEnv(env)).toBe("propai-gateway.cmd");
    expect(resolveDaemonLogPrefixEnv(env)).toBe("propai");
    expect(resolveDaemonServiceVersionEnv(env)).toBe("2.0.0");
  });

  it("does not fallback to OPENCLAW internal service env aliases", () => {
    const env = {
      OPENCLAW_LAUNCHD_LABEL: "ai.openclaw.gateway",
      OPENCLAW_SYSTEMD_UNIT: "openclaw-gateway",
      OPENCLAW_WINDOWS_TASK_NAME: "OpenClaw Gateway",
      OPENCLAW_TASK_SCRIPT: "C:\\OpenClaw\\gateway.cmd",
      OPENCLAW_TASK_SCRIPT_NAME: "gateway.cmd",
      OPENCLAW_LOG_PREFIX: "openclaw",
      OPENCLAW_SERVICE_VERSION: "1.0.0",
    };
    expect(resolveDaemonLaunchdLabelEnv(env)).toBeUndefined();
    expect(resolveDaemonSystemdUnitEnv(env)).toBeUndefined();
    expect(resolveDaemonWindowsTaskNameEnv(env)).toBeUndefined();
    expect(resolveDaemonTaskScriptEnv(env)).toBeUndefined();
    expect(resolveDaemonTaskScriptNameEnv(env)).toBeUndefined();
    expect(resolveDaemonLogPrefixEnv(env)).toBeUndefined();
    expect(resolveDaemonServiceVersionEnv(env)).toBeUndefined();
  });
});
