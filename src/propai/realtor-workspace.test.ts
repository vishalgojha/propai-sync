import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initializeRealtorWorkspaceProfile } from "./realtor-workspace.js";

async function createTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("initializeRealtorWorkspaceProfile", () => {
  it("writes core realtor workspace files with defaults", async () => {
    const workspaceDir = await createTempDir("openclaw-propai-realtor-profile-");
    const result = await initializeRealtorWorkspaceProfile({
      workspaceDir,
    });

    expect(result.workspaceDir).toBe(path.resolve(workspaceDir));
    expect(result.writtenFiles.length).toBe(5);
    expect(result.skippedFiles.length).toBe(0);

    const agents = await fs.readFile(path.join(workspaceDir, "AGENTS.md"), "utf-8");
    const soul = await fs.readFile(path.join(workspaceDir, "SOUL.md"), "utf-8");
    const identity = await fs.readFile(path.join(workspaceDir, "IDENTITY.md"), "utf-8");
    const user = await fs.readFile(path.join(workspaceDir, "USER.md"), "utf-8");
    const heartbeat = await fs.readFile(path.join(workspaceDir, "HEARTBEAT.md"), "utf-8");

    expect(agents).toContain("My Realty Team");
    expect(soul).toContain("Propaiclaw Assistant");
    expect(identity).toContain("Propaiclaw Assistant");
    expect(user).toContain("Broker Owner");
    expect(heartbeat).toContain("HEARTBEAT_OK");
  });

  it("does not overwrite existing files unless overwrite=true", async () => {
    const workspaceDir = await createTempDir("openclaw-propai-realtor-profile-skip-");
    const agentsPath = path.join(workspaceDir, "AGENTS.md");
    await fs.writeFile(agentsPath, "custom-agents", "utf-8");

    const first = await initializeRealtorWorkspaceProfile({
      workspaceDir,
      brokerageName: "Acme Realty",
    });
    expect(first.skippedFiles).toContain(path.resolve(agentsPath));
    expect(await fs.readFile(agentsPath, "utf-8")).toBe("custom-agents");

    const second = await initializeRealtorWorkspaceProfile({
      workspaceDir,
      brokerageName: "Acme Realty",
      overwrite: true,
    });
    expect(second.writtenFiles).toContain(path.resolve(agentsPath));
    expect(await fs.readFile(agentsPath, "utf-8")).toContain("Acme Realty");
  });

  it("supports custom profile values", async () => {
    const workspaceDir = await createTempDir("openclaw-propai-realtor-profile-custom-");
    await initializeRealtorWorkspaceProfile({
      workspaceDir,
      brokerageName: "Sunrise Estates",
      ownerName: "Vishal",
      agentName: "Mira",
      timezone: "America/New_York",
      city: "Miami",
      focus: "Luxury buyer qualification and showing coordination.",
    });

    const agents = await fs.readFile(path.join(workspaceDir, "AGENTS.md"), "utf-8");
    const user = await fs.readFile(path.join(workspaceDir, "USER.md"), "utf-8");
    const identity = await fs.readFile(path.join(workspaceDir, "IDENTITY.md"), "utf-8");

    expect(agents).toContain("Sunrise Estates");
    expect(agents).toContain("Luxury buyer qualification and showing coordination.");
    expect(user).toContain("Vishal");
    expect(user).toContain("Miami");
    expect(identity).toContain("Mira");
    expect(identity).toContain("America/New_York");
  });

  it("uses propaiclaw canonical state dir when PROPAICLAW_MODE is enabled", async () => {
    const tempHome = await createTempDir("propaiclaw-home-");
    const previous = {
      PROPAICLAW_MODE: process.env.PROPAICLAW_MODE,
      PROPAICLAW_HOME: process.env.PROPAICLAW_HOME,
      PROPAICLAW_STATE_DIR: process.env.PROPAICLAW_STATE_DIR,
    };

    try {
      process.env.PROPAICLAW_MODE = "1";
      process.env.PROPAICLAW_HOME = tempHome;
      delete process.env.PROPAICLAW_STATE_DIR;

      const result = await initializeRealtorWorkspaceProfile({});
      expect(result.workspaceDir).toBe(
        path.join(path.resolve(tempHome), ".propaiclaw", "workspace"),
      );
    } finally {
      if (previous.PROPAICLAW_MODE === undefined) {
        delete process.env.PROPAICLAW_MODE;
      } else {
        process.env.PROPAICLAW_MODE = previous.PROPAICLAW_MODE;
      }
      if (previous.PROPAICLAW_HOME === undefined) {
        delete process.env.PROPAICLAW_HOME;
      } else {
        process.env.PROPAICLAW_HOME = previous.PROPAICLAW_HOME;
      }
      if (previous.PROPAICLAW_STATE_DIR === undefined) {
        delete process.env.PROPAICLAW_STATE_DIR;
      } else {
        process.env.PROPAICLAW_STATE_DIR = previous.PROPAICLAW_STATE_DIR;
      }

      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  it("uses PROPAICLAW_PROFILE for workspace suffixing", async () => {
    const tempHome = await createTempDir("propaiclaw-home-profile-");
    const previous = {
      PROPAICLAW_MODE: process.env.PROPAICLAW_MODE,
      PROPAICLAW_HOME: process.env.PROPAICLAW_HOME,
      PROPAICLAW_PROFILE: process.env.PROPAICLAW_PROFILE,
      PROPAICLAW_STATE_DIR: process.env.PROPAICLAW_STATE_DIR,
    };

    try {
      process.env.PROPAICLAW_MODE = "1";
      process.env.PROPAICLAW_HOME = tempHome;
      process.env.PROPAICLAW_PROFILE = "legacy";
      delete process.env.PROPAICLAW_STATE_DIR;

      const profileLegacy = await initializeRealtorWorkspaceProfile({});
      expect(profileLegacy.workspaceDir).toBe(
        path.join(path.resolve(tempHome), ".propaiclaw", "workspace-legacy"),
      );

      process.env.PROPAICLAW_PROFILE = "sales";
      const canonical = await initializeRealtorWorkspaceProfile({});
      expect(canonical.workspaceDir).toBe(
        path.join(path.resolve(tempHome), ".propaiclaw", "workspace-sales"),
      );
    } finally {
      if (previous.PROPAICLAW_MODE === undefined) {
        delete process.env.PROPAICLAW_MODE;
      } else {
        process.env.PROPAICLAW_MODE = previous.PROPAICLAW_MODE;
      }
      if (previous.PROPAICLAW_HOME === undefined) {
        delete process.env.PROPAICLAW_HOME;
      } else {
        process.env.PROPAICLAW_HOME = previous.PROPAICLAW_HOME;
      }
      if (previous.PROPAICLAW_PROFILE === undefined) {
        delete process.env.PROPAICLAW_PROFILE;
      } else {
        process.env.PROPAICLAW_PROFILE = previous.PROPAICLAW_PROFILE;
      }
      if (previous.PROPAICLAW_STATE_DIR === undefined) {
        delete process.env.PROPAICLAW_STATE_DIR;
      } else {
        process.env.PROPAICLAW_STATE_DIR = previous.PROPAICLAW_STATE_DIR;
      }

      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });
});
