import type { IncomingMessage } from "node:http";
import { describe, expect, test } from "vitest";
import { extractHookToken } from "./hooks.js";

describe("extractHookToken header aliases", () => {
  test("prefers bearer token over header tokens", () => {
    const req = {
      headers: {
        authorization: "Bearer bearer-token",
        "x-propaiclaw-token": "propaiclaw-header",
        "x-openclaw-token": "openclaw-header",
      },
    } as unknown as IncomingMessage;

    expect(extractHookToken(req)).toBe("bearer-token");
  });

  test("prefers x-propaiclaw-token over x-openclaw-token", () => {
    const req = {
      headers: {
        "x-propaiclaw-token": "propaiclaw-header",
        "x-openclaw-token": "openclaw-header",
      },
    } as unknown as IncomingMessage;

    expect(extractHookToken(req)).toBe("propaiclaw-header");
  });

  test("accepts legacy x-openclaw-token", () => {
    const req = {
      headers: {
        "x-openclaw-token": "openclaw-header",
      },
    } as unknown as IncomingMessage;

    expect(extractHookToken(req)).toBe("openclaw-header");
  });
});
