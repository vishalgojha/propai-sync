import type { GatewayServiceRuntime } from "../daemon/service-runtime.js";
import type { GatewayService } from "../daemon/service.js";

export type ServiceStatusSummary = {
  label: string;
  installed: boolean | null;
  loaded: boolean;
  managedByPropAiSync: boolean;
  externallyManaged: boolean;
  loadedText: string;
  runtime: GatewayServiceRuntime | undefined;
};

export async function readServiceStatusSummary(
  service: GatewayService,
  fallbackLabel: string,
): Promise<ServiceStatusSummary> {
  try {
    const [loaded, runtime, command] = await Promise.all([
      service.isLoaded({ env: process.env }).catch(() => false),
      service.readRuntime(process.env).catch(() => undefined),
      service.readCommand(process.env).catch(() => null),
    ]);
    const managedByPropAiSync = command != null;
    const externallyManaged = !managedByPropAiSync && runtime?.status === "running";
    const installed = managedByPropAiSync || externallyManaged;
    const loadedText = externallyManaged
      ? "running (externally managed)"
      : loaded
        ? service.loadedText
        : service.notLoadedText;
    return {
      label: service.label,
      installed,
      loaded,
      managedByPropAiSync,
      externallyManaged,
      loadedText,
      runtime,
    };
  } catch {
    return {
      label: fallbackLabel,
      installed: null,
      loaded: false,
      managedByPropAiSync: false,
      externallyManaged: false,
      loadedText: "unknown",
      runtime: undefined,
    };
  }
}


