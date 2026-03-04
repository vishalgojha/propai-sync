import type { PathLike } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { writeJsonAtomic } from "./json-files.js";

function errnoError(code: string): Error & { code: string } {
  const error = new Error(code) as Error & { code: string };
  error.code = code;
  return error;
}

describe("writeJsonAtomic", () => {
  it("retries transient rename contention and still persists json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openclaw-json-files-"));
    const target = join(dir, "state.json");

    const rename = fs.rename.bind(fs);
    let renameCalls = 0;
    const renameSpy = vi
      .spyOn(fs, "rename")
      .mockImplementation(async (oldPath: PathLike, newPath: PathLike) => {
        renameCalls += 1;
        if (renameCalls < 3) {
          throw errnoError("EPERM");
        }
        await rename(oldPath, newPath);
      });

    try {
      await writeJsonAtomic(target, { ok: true });
    } finally {
      renameSpy.mockRestore();
    }

    expect(renameCalls).toBe(3);
    await expect(readFile(target, "utf8")).resolves.toContain('"ok": true');
  });
});
