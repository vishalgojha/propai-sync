import "./styles.css";

const DESKTOP_ONBOARDING_DONE_KEY = "openclaw.desktop.onboarding.done";

function readDesktopOnboardingDoneFlag(): boolean {
  try {
    return window.localStorage?.getItem(DESKTOP_ONBOARDING_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function enableDesktopOnboardingIfFirstRun() {
  if (typeof window === "undefined") {
    return;
  }
  const w = window as unknown as Record<string, unknown>;
  const isTauri = "__TAURI_INTERNALS__" in w || "__TAURI__" in w;
  if (!isTauri) {
    return;
  }

  try {
    // Match `ui/src/ui/storage.ts` key.
    const hasPersistedSettings = Boolean(localStorage.getItem("openclaw.control.settings.v1"));
    if (hasPersistedSettings || readDesktopOnboardingDoneFlag()) {
      return;
    }

    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    if (params.has("onboarding")) {
      return;
    }
    params.set("onboarding", "1");
    const next = `${url.pathname}?${params.toString()}${url.hash || ""}`;
    window.history.replaceState(null, "", next);
  } catch {
    // best-effort
  }
}

enableDesktopOnboardingIfFirstRun();
await import("./ui/app.ts");
