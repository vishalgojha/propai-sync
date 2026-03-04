import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadWorkspaceSkillEntries } from "./skills.js";

const PROPAI_SKILLS = [
  "action-suggester",
  "india-location-normalizer",
  "lead-extractor",
  "lead-storage",
  "message-parser",
  "summary-generator",
] as const;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUNDLED_SKILLS_DIR = path.join(REPO_ROOT, "skills");

describe("PropAi Sync bundled skills", () => {
  it("ships required skill folders and schema references", () => {
    for (const skillName of PROPAI_SKILLS) {
      const skillDir = path.join(BUNDLED_SKILLS_DIR, skillName);
      expect(fs.existsSync(skillDir)).toBe(true);
      expect(fs.existsSync(path.join(skillDir, "SKILL.md"))).toBe(true);
      expect(fs.existsSync(path.join(skillDir, "agents", "openai.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(skillDir, "references"))).toBe(true);
    }
  });

  it("loads PropAi Sync skills from bundled dir without extra config", async () => {
    const workspaceDir = await fsp.mkdtemp(path.join(os.tmpdir(), "openclaw-propai-"));
    try {
      const managedSkillsDir = path.join(workspaceDir, ".managed");
      await fsp.mkdir(managedSkillsDir, { recursive: true });

      const entries = loadWorkspaceSkillEntries(workspaceDir, {
        managedSkillsDir,
        bundledSkillsDir: BUNDLED_SKILLS_DIR,
      });
      const names = new Set(entries.map((entry) => entry.skill.name));

      for (const skillName of PROPAI_SKILLS) {
        expect(names.has(skillName)).toBe(true);
      }
    } finally {
      await fsp.rm(workspaceDir, { recursive: true, force: true });
    }
  });
});
