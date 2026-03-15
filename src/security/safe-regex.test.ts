import { describe, expect, it } from "vitest";
import { compileSafeRegex, hasNestedRepetition, testRegexWithBoundedInput } from "./safe-regex.js";

describe("safe regex", () => {
  it("flags nested repetition patterns", () => {
    expect(hasNestedRepetition("(a+)+$")).toBe(true);
    expect(hasNestedRepetition("(a|aa)+$")).toBe(true);
    expect(hasNestedRepetition("^(?:foo|bar)$")).toBe(false);
    expect(hasNestedRepetition("^(ab|cd)+$")).toBe(false);
  });

  it("rejects unsafe nested repetition during compile", () => {
    expect(compileSafeRegex("(a+)+$")).toBeNull();
    expect(compileSafeRegex("(a|aa)+$")).toBeNull();
    expect(compileSafeRegex("(a|aa){2}$")).toBeInstanceOf(RegExp);
  });

  it("compiles common safe filter regex", () => {
    const re = compileSafeRegex("^agent:.*:telegram:");
    expect(re).toBeInstanceOf(RegExp);
    expect(re?.test("agent:main:telegram:channel:123")).toBe(true);
    expect(re?.test("agent:main:whatsapp:channel:123")).toBe(false);
  });

  it("supports explicit flags", () => {
    const re = compileSafeRegex("token=([A-Za-z0-9]+)", "gi");
    expect(re).toBeInstanceOf(RegExp);
    expect("TOKEN=abcd1234".replace(re as RegExp, "***")).toBe("***");
  });

  it("checks bounded regex windows for long inputs", () => {
    expect(
      testRegexWithBoundedInput(
        /^agent:main:telegram:/,
        `agent:main:telegram:${"x".repeat(5000)}`,
      ),
    ).toBe(true);
    expect(testRegexWithBoundedInput(/telegram:tail$/, `${"x".repeat(5000)}telegram:tail`)).toBe(
      true,
    );
    expect(testRegexWithBoundedInput(/telegram:tail$/, `${"x".repeat(5000)}whatsapp:tail`)).toBe(
      false,
    );
  });
});
