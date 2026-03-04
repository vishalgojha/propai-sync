import { describe, expect, it } from "vitest";
import {
  CANVAS_CAPABILITY_PATH_PREFIX,
  CANVAS_CAPABILITY_PATH_PREFIX_ALIASES,
  CANVAS_CAPABILITY_QUERY_PARAM,
  buildCanvasScopedHostUrl,
  normalizeCanvasScopedUrl,
} from "./canvas-capability.js";

const PROPAICLAW_CANVAS_CAPABILITY_PATH_PREFIX =
  CANVAS_CAPABILITY_PATH_PREFIX_ALIASES.find((path) => path !== CANVAS_CAPABILITY_PATH_PREFIX) ??
  CANVAS_CAPABILITY_PATH_PREFIX;

describe("canvas capability path aliases", () => {
  it("keeps canonical prefix when building scoped host URL", () => {
    const out = buildCanvasScopedHostUrl("http://127.0.0.1:18789/__openclaw__/canvas", "tok");
    expect(out).toContain(`${CANVAS_CAPABILITY_PATH_PREFIX}/tok`);
  });

  it("normalizes propaiclaw scoped prefix into capability query", () => {
    const scoped = normalizeCanvasScopedUrl(
      `${PROPAICLAW_CANVAS_CAPABILITY_PATH_PREFIX}/abc123/__propaiclaw__/canvas/?foo=bar`,
    );
    expect(scoped.scopedPath).toBe(true);
    expect(scoped.malformedScopedPath).toBe(false);
    expect(scoped.capability).toBe("abc123");
    expect(scoped.pathname).toBe("/__propaiclaw__/canvas/");
    expect(scoped.rewrittenUrl).toContain(`foo=bar`);
    expect(scoped.rewrittenUrl).toContain(`${CANVAS_CAPABILITY_QUERY_PARAM}=abc123`);
  });

  it("marks malformed scoped alias URLs", () => {
    const scoped = normalizeCanvasScopedUrl(`${PROPAICLAW_CANVAS_CAPABILITY_PATH_PREFIX}/broken`);
    expect(scoped.scopedPath).toBe(true);
    expect(scoped.malformedScopedPath).toBe(true);
  });
});
