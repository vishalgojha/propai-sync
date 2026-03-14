import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/PropAiSync" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchPropAiSyncChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolvePropAiSyncUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopPropAiSyncChrome: vi.fn(async () => {}),
}));



