import { afterEach, describe, expect, it, vi } from "vitest";
import {
  A2UI_PATH,
  CANVAS_HOST_PATH,
  CANVAS_WS_PATH,
  PROPAICLAW_A2UI_PATH,
  PROPAICLAW_CANVAS_HOST_PATH,
  PROPAICLAW_CANVAS_WS_PATH,
  resolvePreferredA2uiPath,
  resolvePreferredCanvasHostPath,
  resolvePreferredCanvasWsPath,
} from "./a2ui.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("canvas host preferred paths", () => {
  it("defaults to legacy OpenClaw paths", () => {
    vi.stubEnv("PROPAICLAW_MODE", "");
    expect(resolvePreferredA2uiPath()).toBe(A2UI_PATH);
    expect(resolvePreferredCanvasHostPath()).toBe(CANVAS_HOST_PATH);
    expect(resolvePreferredCanvasWsPath()).toBe(CANVAS_WS_PATH);
  });

  it("switches to PropAI paths in PROPAICLAW_MODE", () => {
    vi.stubEnv("PROPAICLAW_MODE", "1");
    expect(resolvePreferredA2uiPath()).toBe(PROPAICLAW_A2UI_PATH);
    expect(resolvePreferredCanvasHostPath()).toBe(PROPAICLAW_CANVAS_HOST_PATH);
    expect(resolvePreferredCanvasWsPath()).toBe(PROPAICLAW_CANVAS_WS_PATH);
  });
});

