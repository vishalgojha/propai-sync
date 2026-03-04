import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("propaiclaw packaging", () => {
  it("publishes propai and propaiclaw global bins", async () => {
    const packageJson = JSON.parse(
      await fsp.readFile(path.join(REPO_ROOT, "package.json"), "utf8"),
    );

    expect(packageJson.name).toBe("propaiclaw");
    expect(packageJson.bin).toEqual({
      propai: "propai.mjs",
      propaiclaw: "propaiclaw.mjs",
    });
    expect(packageJson.files).toContain("propai.mjs");
  });

  it("loads the propaiclaw dist entrypoint", async () => {
    const wrapper = await fsp.readFile(path.join(REPO_ROOT, "propaiclaw.mjs"), "utf8");

    expect(wrapper).toContain("./dist/propaiclaw-entry.js");
    expect(wrapper).toContain("./dist/propaiclaw-entry.mjs");
  });

  it("loads the propai dist entrypoint", async () => {
    const wrapper = await fsp.readFile(path.join(REPO_ROOT, "propai.mjs"), "utf8");

    expect(wrapper).toContain("./dist/propaiclaw-entry.js");
    expect(wrapper).toContain("./dist/propaiclaw-entry.mjs");
  });
});
