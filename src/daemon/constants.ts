import { resolveDaemonProfileEnv, resolveDaemonServiceVersionEnv } from "./env-aliases.js";

// Default service labels (canonical + legacy compatibility)
export const GATEWAY_LAUNCH_AGENT_LABEL = "ai.propaiclaw.gateway";
export const GATEWAY_SYSTEMD_SERVICE_NAME = "propaiclaw-gateway";
export const GATEWAY_WINDOWS_TASK_NAME = "Propaiclaw Gateway";
export const GATEWAY_SERVICE_MARKER = "openclaw";
export const GATEWAY_SERVICE_KIND = "gateway";
export const NODE_LAUNCH_AGENT_LABEL = "ai.propaiclaw.node";
export const NODE_SYSTEMD_SERVICE_NAME = "propaiclaw-node";
export const NODE_WINDOWS_TASK_NAME = "Propaiclaw Node";
export const NODE_SERVICE_MARKER = "openclaw";
export const NODE_SERVICE_KIND = "node";
export const NODE_WINDOWS_TASK_SCRIPT_NAME = "node.cmd";
export const LEGACY_GATEWAY_LAUNCH_AGENT_LABELS: string[] = [
  "ai.openclaw.gateway",
  "com.openclaw.gateway",
];
export const LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES: string[] = [
  "openclaw-gateway",
  "clawdbot-gateway",
  "moltbot-gateway",
];
export const LEGACY_GATEWAY_WINDOWS_TASK_NAMES: string[] = ["OpenClaw Gateway"];

export function normalizeGatewayProfile(profile?: string): string | null {
  const trimmed = profile?.trim();
  if (!trimmed || trimmed.toLowerCase() === "default") {
    return null;
  }
  return trimmed;
}

export function resolveGatewayProfileSuffix(profile?: string): string {
  const normalized = normalizeGatewayProfile(profile);
  return normalized ? `-${normalized}` : "";
}

export function resolveGatewayLaunchAgentLabel(profile?: string): string {
  const normalized = normalizeGatewayProfile(profile);
  if (!normalized) {
    return GATEWAY_LAUNCH_AGENT_LABEL;
  }
  return `ai.propaiclaw.${normalized}`;
}

export function resolveLegacyGatewayLaunchAgentLabels(profile?: string): string[] {
  const normalized = normalizeGatewayProfile(profile);
  const labels = new Set<string>(LEGACY_GATEWAY_LAUNCH_AGENT_LABELS);
  if (normalized) {
    labels.add(`ai.openclaw.${normalized}`);
    labels.add(`ai.openclaw.gateway-${normalized}`);
    labels.add(`com.openclaw.${normalized}`);
    labels.add(`com.openclaw.gateway-${normalized}`);
  }
  return Array.from(labels);
}

export function resolveGatewaySystemdServiceName(profile?: string): string {
  const suffix = resolveGatewayProfileSuffix(profile);
  if (!suffix) {
    return GATEWAY_SYSTEMD_SERVICE_NAME;
  }
  return `propaiclaw-gateway${suffix}`;
}

export function resolveLegacyGatewaySystemdServiceNames(profile?: string): string[] {
  const suffix = resolveGatewayProfileSuffix(profile);
  const names = new Set<string>(LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES);
  names.add(`openclaw-gateway${suffix}`);
  return Array.from(names);
}

export function resolveGatewayWindowsTaskName(profile?: string): string {
  const normalized = normalizeGatewayProfile(profile);
  if (!normalized) {
    return GATEWAY_WINDOWS_TASK_NAME;
  }
  return `Propaiclaw Gateway (${normalized})`;
}

export function resolveLegacyGatewayWindowsTaskNames(profile?: string): string[] {
  const normalized = normalizeGatewayProfile(profile);
  const names = new Set<string>(LEGACY_GATEWAY_WINDOWS_TASK_NAMES);
  if (normalized) {
    names.add(`OpenClaw Gateway (${normalized})`);
  }
  return Array.from(names);
}

export function formatGatewayServiceDescription(params?: {
  profile?: string;
  version?: string;
}): string {
  const profile = normalizeGatewayProfile(params?.profile);
  const version = params?.version?.trim();
  const parts: string[] = [];
  if (profile) {
    parts.push(`profile: ${profile}`);
  }
  if (version) {
    parts.push(`v${version}`);
  }
  if (parts.length === 0) {
    return "Propaiclaw Gateway";
  }
  return `Propaiclaw Gateway (${parts.join(", ")})`;
}

export function resolveGatewayServiceDescription(params: {
  env: Record<string, string | undefined>;
  environment?: Record<string, string | undefined>;
  description?: string;
}): string {
  return (
    params.description ??
    formatGatewayServiceDescription({
      profile: resolveDaemonProfileEnv(params.env),
      version:
        (params.environment ? resolveDaemonServiceVersionEnv(params.environment) : undefined) ??
        resolveDaemonServiceVersionEnv(params.env),
    })
  );
}

export function resolveNodeLaunchAgentLabel(): string {
  return NODE_LAUNCH_AGENT_LABEL;
}

export function resolveNodeSystemdServiceName(): string {
  return NODE_SYSTEMD_SERVICE_NAME;
}

export function resolveNodeWindowsTaskName(): string {
  return NODE_WINDOWS_TASK_NAME;
}

export function formatNodeServiceDescription(params?: { version?: string }): string {
  const version = params?.version?.trim();
  if (!version) {
    return "Propaiclaw Node Host";
  }
  return `Propaiclaw Node Host (v${version})`;
}
