type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
type ListenFn = <T>(
  event: string,
  handler: (event: { payload: T }) => void,
) => Promise<() => void>;

function hasTauriGlobals(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as unknown as Record<string, unknown>;
  return "__TAURI_INTERNALS__" in w || "__TAURI__" in w;
}

export function isTauriRuntime(): boolean {
  return hasTauriGlobals();
}

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const mod = (await import("@tauri-apps/api/core")) as { invoke?: InvokeFn };
  if (typeof mod.invoke !== "function") {
    throw new Error("Tauri invoke is unavailable");
  }
  return await mod.invoke<T>(cmd, args);
}

export async function tauriListen<T>(
  event: string,
  handler: (event: { payload: T }) => void,
): Promise<() => void> {
  const mod = (await import("@tauri-apps/api/event")) as { listen?: ListenFn };
  if (typeof mod.listen !== "function") {
    throw new Error("Tauri listen is unavailable");
  }
  return await mod.listen<T>(event, handler);
}
