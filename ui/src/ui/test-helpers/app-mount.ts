import { afterEach, beforeEach } from "vitest";
import "../app.ts";
import type { PropAiSyncApp } from "../app.ts";

export function mountApp(pathname: string) {
  window.history.replaceState({}, "", pathname);
  const app = document.createElement("propai-app") as PropAiSyncApp;
  app.connect = () => {
    // no-op: avoid real gateway WS connections in browser tests
  };
  document.body.append(app);
  return app;
}

export function registerAppMountHooks() {
  beforeEach(() => {
    window.__PROPAI_CONTROL_UI_BASE_PATH__ = undefined;
    (window as unknown as { __PROPAI_LICENSE_BYPASS__?: boolean }).__PROPAI_LICENSE_BYPASS__ = true;
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    window.__PROPAI_CONTROL_UI_BASE_PATH__ = undefined;
    (window as unknown as { __PROPAI_LICENSE_BYPASS__?: boolean }).__PROPAI_LICENSE_BYPASS__ =
      undefined;
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = "";
  });
}



