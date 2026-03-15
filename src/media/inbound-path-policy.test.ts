import { describe, expect, it } from "vitest";
import {
  isInboundPathAllowed,
  isValidInboundPathRootPattern,
  mergeInboundPathRoots,
} from "./inbound-path-policy.js";

describe("inbound-path-policy", () => {
  it("validates absolute root patterns", () => {
    expect(isValidInboundPathRootPattern("/Users/*/Library/Messages/Attachments")).toBe(true);
    expect(isValidInboundPathRootPattern("/Volumes/relay/attachments")).toBe(true);
    expect(isValidInboundPathRootPattern("./attachments")).toBe(false);
    expect(isValidInboundPathRootPattern("/Users/**/Attachments")).toBe(false);
  });

  it("matches wildcard roots for attachment paths", () => {
    const roots = ["/Users/*/Library/Messages/Attachments"];
    expect(
      isInboundPathAllowed({
        filePath: "/Users/alice/Library/Messages/Attachments/12/34/ABCDEF/IMG_0001.jpeg",
        roots,
      }),
    ).toBe(true);
    expect(
      isInboundPathAllowed({
        filePath: "/etc/passwd",
        roots,
      }),
    ).toBe(false);
  });

  it("normalizes and de-duplicates merged roots", () => {
    const roots = mergeInboundPathRoots(
      ["/Users/*/Library/Messages/Attachments/", "/Users/*/Library/Messages/Attachments"],
      ["/Volumes/relay/attachments"],
    );
    expect(roots).toEqual(["/Users/*/Library/Messages/Attachments", "/Volumes/relay/attachments"]);
  });

});
