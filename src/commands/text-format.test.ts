import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("PropAi Sync", 16)).toBe("PropAi Sync");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("propai-status-output", 10)).toBe("propai-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});


