import { describe, expect, it } from "vitest";
import {
  formatConfigInvalidHint,
  formatRuntimeDebugLine,
  formatRuntimeLaunchFailure,
  formatRuntimeSignalExit,
} from "./propaiclaw-entry.messages.js";

describe("propaiclaw entry user-facing messages", () => {
  it("renders debug runtime command without openclaw wording", () => {
    const line = formatRuntimeDebugLine("propai", ["gateway", "run"]);
    expect(line).toBe("[propai debug] runtime gateway run\n");
    expect(line.toLowerCase()).not.toContain("openclaw");
  });

  it("renders runtime launch failure without openclaw wording", () => {
    const line = formatRuntimeLaunchFailure("propaiclaw", "spawn EPERM");
    expect(line).toBe("[propaiclaw] Failed to launch Propaiclaw runtime: spawn EPERM\n");
    expect(line.toLowerCase()).not.toContain("openclaw");
  });

  it("renders runtime signal exit without openclaw wording", () => {
    const line = formatRuntimeSignalExit("propaiclaw", "SIGTERM");
    expect(line).toBe("[propaiclaw] Propaiclaw runtime exited due to signal SIGTERM\n");
    expect(line.toLowerCase()).not.toContain("openclaw");
  });

  it("renders config-invalid hint with active command name", () => {
    const line = formatConfigInvalidHint("propai");
    expect(line).toBe('[propai] Config is invalid. Run "propai sync --debug" and retry.\n');
    expect(line.toLowerCase()).not.toContain("openclaw");
  });
});
