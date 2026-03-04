import { describe, expect, it } from "vitest";
import {
  formatGatewayServiceDescription,
  GATEWAY_LAUNCH_AGENT_LABEL,
  GATEWAY_SYSTEMD_SERVICE_NAME,
  GATEWAY_WINDOWS_TASK_NAME,
  LEGACY_GATEWAY_LAUNCH_AGENT_LABELS,
  LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES,
  LEGACY_GATEWAY_WINDOWS_TASK_NAMES,
  normalizeGatewayProfile,
  resolveGatewayLaunchAgentLabel,
  resolveGatewayProfileSuffix,
  resolveGatewayServiceDescription,
  resolveGatewaySystemdServiceName,
  resolveGatewayWindowsTaskName,
  resolveLegacyGatewayLaunchAgentLabels,
  resolveLegacyGatewaySystemdServiceNames,
  resolveLegacyGatewayWindowsTaskNames,
} from "./constants.js";

describe("normalizeGatewayProfile", () => {
  it("returns null for empty/default profiles", () => {
    expect(normalizeGatewayProfile()).toBeNull();
    expect(normalizeGatewayProfile("")).toBeNull();
    expect(normalizeGatewayProfile("   ")).toBeNull();
    expect(normalizeGatewayProfile("default")).toBeNull();
    expect(normalizeGatewayProfile(" Default ")).toBeNull();
  });

  it("returns trimmed custom profiles", () => {
    expect(normalizeGatewayProfile("dev")).toBe("dev");
    expect(normalizeGatewayProfile("  staging  ")).toBe("staging");
  });
});

describe("resolveGatewayLaunchAgentLabel", () => {
  it("returns default label when no profile is set", () => {
    const result = resolveGatewayLaunchAgentLabel();
    expect(result).toBe(GATEWAY_LAUNCH_AGENT_LABEL);
    expect(result).toBe("ai.propaiclaw.gateway");
  });

  it("returns profile-specific label when profile is set", () => {
    const result = resolveGatewayLaunchAgentLabel("dev");
    expect(result).toBe("ai.propaiclaw.dev");
  });
});

describe("resolveGatewaySystemdServiceName", () => {
  it("returns default service name when no profile is set", () => {
    const result = resolveGatewaySystemdServiceName();
    expect(result).toBe(GATEWAY_SYSTEMD_SERVICE_NAME);
    expect(result).toBe("propaiclaw-gateway");
  });

  it("returns profile-specific service name when profile is set", () => {
    const result = resolveGatewaySystemdServiceName("dev");
    expect(result).toBe("propaiclaw-gateway-dev");
  });
});

describe("resolveGatewayWindowsTaskName", () => {
  it("returns default task name when no profile is set", () => {
    const result = resolveGatewayWindowsTaskName();
    expect(result).toBe(GATEWAY_WINDOWS_TASK_NAME);
    expect(result).toBe("Propaiclaw Gateway");
  });

  it("returns profile-specific task name when profile is set", () => {
    const result = resolveGatewayWindowsTaskName("dev");
    expect(result).toBe("Propaiclaw Gateway (dev)");
  });
});

describe("resolveGatewayProfileSuffix", () => {
  it("returns empty string when no profile is set", () => {
    expect(resolveGatewayProfileSuffix()).toBe("");
  });

  it("returns empty string for default profiles", () => {
    expect(resolveGatewayProfileSuffix("default")).toBe("");
    expect(resolveGatewayProfileSuffix(" Default ")).toBe("");
  });

  it("returns a hyphenated suffix for custom profiles", () => {
    expect(resolveGatewayProfileSuffix("dev")).toBe("-dev");
  });

  it("trims whitespace from profiles", () => {
    expect(resolveGatewayProfileSuffix("  staging  ")).toBe("-staging");
  });
});

describe("formatGatewayServiceDescription", () => {
  it("returns default description when no profile/version", () => {
    expect(formatGatewayServiceDescription()).toBe("Propaiclaw Gateway");
  });

  it("includes profile when set", () => {
    expect(formatGatewayServiceDescription({ profile: "work" })).toBe(
      "Propaiclaw Gateway (profile: work)",
    );
  });

  it("includes version when set", () => {
    expect(formatGatewayServiceDescription({ version: "2026.1.10" })).toBe(
      "Propaiclaw Gateway (v2026.1.10)",
    );
  });

  it("includes profile and version when set", () => {
    expect(formatGatewayServiceDescription({ profile: "dev", version: "1.2.3" })).toBe(
      "Propaiclaw Gateway (profile: dev, v1.2.3)",
    );
  });
});

describe("resolveGatewayServiceDescription", () => {
  it("prefers explicit description override", () => {
    expect(
      resolveGatewayServiceDescription({
        env: { PROPAICLAW_PROFILE: "work", PROPAICLAW_SERVICE_VERSION: "1.0.0" },
        description: "Custom",
      }),
    ).toBe("Custom");
  });

  it("resolves version from explicit environment map", () => {
    expect(
      resolveGatewayServiceDescription({
        env: { PROPAICLAW_PROFILE: "work", PROPAICLAW_SERVICE_VERSION: "local" },
        environment: { PROPAICLAW_SERVICE_VERSION: "remote" },
      }),
    ).toBe("Propaiclaw Gateway (profile: work, vremote)");
  });

  it("uses PROPAICLAW_PROFILE when set", () => {
    expect(
      resolveGatewayServiceDescription({
        env: {
          PROPAICLAW_PROFILE: "pro",
          PROPAICLAW_SERVICE_VERSION: "1.0.0",
        },
      }),
    ).toBe("Propaiclaw Gateway (profile: pro, v1.0.0)");
  });
});

describe("legacy gateway identity resolvers", () => {
  it("keeps legacy LaunchAgent labels for default and profile modes", () => {
    expect(LEGACY_GATEWAY_LAUNCH_AGENT_LABELS).toContain("ai.openclaw.gateway");
    expect(LEGACY_GATEWAY_LAUNCH_AGENT_LABELS).toContain("com.openclaw.gateway");
    expect(resolveLegacyGatewayLaunchAgentLabels()).toContain("ai.openclaw.gateway");
    expect(resolveLegacyGatewayLaunchAgentLabels()).toContain("com.openclaw.gateway");
    expect(resolveLegacyGatewayLaunchAgentLabels("dev")).toContain("ai.openclaw.dev");
    expect(resolveLegacyGatewayLaunchAgentLabels("dev")).toContain("ai.openclaw.gateway-dev");
    expect(resolveLegacyGatewayLaunchAgentLabels("dev")).toContain("com.openclaw.dev");
    expect(resolveLegacyGatewayLaunchAgentLabels("dev")).toContain("com.openclaw.gateway-dev");
  });

  it("keeps legacy systemd names for default and profile modes", () => {
    expect(LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES).toContain("openclaw-gateway");
    expect(resolveLegacyGatewaySystemdServiceNames()).toContain("openclaw-gateway");
    expect(resolveLegacyGatewaySystemdServiceNames("dev")).toContain("openclaw-gateway-dev");
  });

  it("keeps legacy Windows task names for default and profile modes", () => {
    expect(LEGACY_GATEWAY_WINDOWS_TASK_NAMES).toContain("OpenClaw Gateway");
    expect(resolveLegacyGatewayWindowsTaskNames()).toContain("OpenClaw Gateway");
    expect(resolveLegacyGatewayWindowsTaskNames("dev")).toContain("OpenClaw Gateway (dev)");
  });
});

describe("LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES", () => {
  it("includes known pre-rebrand gateway unit names", () => {
    expect(LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES).toContain("openclaw-gateway");
    expect(LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES).toContain("clawdbot-gateway");
    expect(LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES).toContain("moltbot-gateway");
  });
});
