import { describe, expect, it, vi } from "vitest";
import { maybeSeedRealtorWorkspaceBeforeSetup, readLongOptionValue } from "./setup-bootstrap.js";

describe("readLongOptionValue", () => {
  it("reads --flag value from separate token", () => {
    const value = readLongOptionValue(["onboard", "--workspace", "C:\\ws"], "--workspace");
    expect(value).toBe("C:\\ws");
  });

  it("reads --flag=value format", () => {
    const value = readLongOptionValue(["onboard", "--workspace=C:\\ws"], "--workspace");
    expect(value).toBe("C:\\ws");
  });

  it("returns undefined when flag is missing", () => {
    const value = readLongOptionValue(["onboard", "--flow", "quickstart"], "--workspace");
    expect(value).toBeUndefined();
  });
});

describe("maybeSeedRealtorWorkspaceBeforeSetup", () => {
  it("skips non-setup commands", async () => {
    const initProfile = vi.fn();
    await maybeSeedRealtorWorkspaceBeforeSetup(
      {
        commandLabel: "start",
        args: ["gateway", "run"],
        debug: false,
      },
      { initProfile },
    );
    expect(initProfile).not.toHaveBeenCalled();
  });

  it("seeds workspace for sync and forwards env + workspace", async () => {
    const initProfile = vi.fn(async () => ({
      workspaceDir: "C:\\realtor-ws",
      writtenFiles: ["AGENTS.md"],
      skippedFiles: [],
    }));
    const stdoutWrite = vi.fn();

    await maybeSeedRealtorWorkspaceBeforeSetup(
      {
        commandLabel: "sync",
        args: ["onboard", "--flow", "quickstart", "--workspace", "C:\\realtor-ws"],
        debug: false,
      },
      {
        env: {
          PROPAICLAW_BROKERAGE_NAME: "Acme Realty",
          PROPAICLAW_OWNER_NAME: "Vishal",
          PROPAICLAW_AGENT_NAME: "Acme Assistant",
          PROPAICLAW_CITY: "Miami",
          PROPAICLAW_TIMEZONE: "America/New_York",
          PROPAICLAW_FOCUS: "Inbound WhatsApp lead triage",
        },
        initProfile,
        stdoutWrite,
      },
    );

    expect(initProfile).toHaveBeenCalledWith({
      brokerageName: "Acme Realty",
      ownerName: "Vishal",
      agentName: "Acme Assistant",
      timezone: "America/New_York",
      city: "Miami",
      focus: "Inbound WhatsApp lead triage",
      workspaceDir: "C:\\realtor-ws",
      overwrite: false,
    });
    expect(stdoutWrite).toHaveBeenCalledWith(
      "[propaiclaw] Prepared realtor workspace profile (1 files).\n",
    );
  });

  it("still accepts legacy PROPAI_* env vars", async () => {
    const initProfile = vi.fn(async () => ({
      workspaceDir: "C:\\legacy-ws",
      writtenFiles: ["AGENTS.md"],
      skippedFiles: [],
    }));

    await maybeSeedRealtorWorkspaceBeforeSetup(
      {
        commandLabel: "sync",
        args: ["onboard", "--workspace", "C:\\legacy-ws"],
        debug: false,
      },
      {
        env: {
          PROPAI_BROKERAGE_NAME: "Legacy Realty",
          PROPAI_OWNER_NAME: "Owner",
        },
        initProfile,
      },
    );

    expect(initProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        brokerageName: "Legacy Realty",
        ownerName: "Owner",
      }),
    );
  });

  it("fails open and logs warning when profile seed errors", async () => {
    const initProfile = vi.fn(async () => {
      throw new Error("disk offline");
    });
    const stderrWrite = vi.fn();

    await maybeSeedRealtorWorkspaceBeforeSetup(
      {
        commandLabel: "setup",
        args: ["onboard", "--flow", "quickstart"],
        debug: false,
      },
      { initProfile, stderrWrite },
    );

    expect(stderrWrite).toHaveBeenCalledWith(
      "[propaiclaw] Could not pre-seed realtor workspace profile. Continuing setup.\n",
    );
  });
});
