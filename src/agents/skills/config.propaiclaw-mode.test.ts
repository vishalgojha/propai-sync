import { describe, expect, it } from "vitest";
import { withEnv } from "../../test-utils/env.js";
import { resolveBundledAllowlist, shouldIncludeSkill } from "./config.js";
import type { SkillEntry } from "./types.js";

function makeSkillEntry(name: string, source: string): SkillEntry {
  return {
    skill: {
      name,
      description: `desc:${name}`,
      source,
      filePath: `/tmp/${name}/SKILL.md`,
      baseDir: `/tmp/${name}`,
      disableModelInvocation: false,
    },
    frontmatter: {},
    metadata: {},
  };
}

describe("skills/config propaiclaw mode", () => {
  it("uses a default bundled allowlist in propaiclaw mode", () => {
    const allowlist = withEnv({ PROPAICLAW_MODE: "1" }, () => resolveBundledAllowlist(undefined));
    expect(allowlist).toEqual([
      "action-suggester",
      "india-location-normalizer",
      "lead-extractor",
      "lead-storage",
      "message-parser",
      "summary-generator",
    ]);
  });

  it("lets explicit config allowBundled override propaiclaw defaults", () => {
    const allowlist = withEnv({ PROPAICLAW_MODE: "1" }, () =>
      resolveBundledAllowlist({ skills: { allowBundled: ["custom-skill"] } }),
    );
    expect(allowlist).toEqual(["custom-skill"]);
  });

  it("filters bundled skills while preserving workspace skills in propaiclaw mode", () => {
    const bundledAllowed = makeSkillEntry("message-parser", "openclaw-bundled");
    const bundledBlocked = makeSkillEntry("blindspot-supervisor", "openclaw-bundled");
    const workspaceSkill = makeSkillEntry("my-custom-skill", "openclaw-workspace");

    const verdict = withEnv({ PROPAICLAW_MODE: "1" }, () => ({
      bundledAllowed: shouldIncludeSkill({ entry: bundledAllowed }),
      bundledBlocked: shouldIncludeSkill({ entry: bundledBlocked }),
      workspaceSkill: shouldIncludeSkill({ entry: workspaceSkill }),
    }));

    expect(verdict.bundledAllowed).toBe(true);
    expect(verdict.bundledBlocked).toBe(false);
    expect(verdict.workspaceSkill).toBe(true);
  });
});
