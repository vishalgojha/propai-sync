import { describe, expect, it, vi } from "vitest";
import { logGatewayStartup } from "./server-startup-log.js";

describe("gateway startup log", () => {
  it("warns when dangerous config flags are enabled", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {
        gateway: {
          controlUi: {
            dangerouslyDisableDeviceAuth: true,
          },
        },
      },
      bindHost: "127.0.0.1",
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("dangerous config flags enabled"));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("gateway.controlUi.dangerouslyDisableDeviceAuth=true"),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("openclaw security audit"));
  });

  it("does not warn when dangerous config flags are disabled", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {},
      bindHost: "127.0.0.1",
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it("logs all listen endpoints on a single line", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {},
      bindHost: "127.0.0.1",
      bindHosts: ["127.0.0.1", "::1"],
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    const listenMessages = info.mock.calls
      .map((call) => call[0])
      .filter((message) => message.startsWith("listening on "));
    expect(listenMessages).toEqual([
      `listening on ws://127.0.0.1:18789, ws://[::1]:18789 (PID ${process.pid})`,
    ]);
  });

  it("logs control ui url on startup when control ui is enabled", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {},
      bindHost: "127.0.0.1",
      bindHosts: ["127.0.0.1", "::1"],
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    expect(
      info.mock.calls.some((call) => call[0] === "control ui: http://127.0.0.1:18789/"),
    ).toBe(true);
  });

  it("logs propai ui url label in PROPAICLAW mode", () => {
    const previous = process.env.PROPAICLAW_MODE;
    process.env.PROPAICLAW_MODE = "1";
    try {
      const info = vi.fn();
      const warn = vi.fn();

      logGatewayStartup({
        cfg: {},
        bindHost: "127.0.0.1",
        port: 18789,
        log: { info, warn },
        isNixMode: false,
      });

      expect(
        info.mock.calls.some((call) => call[0] === "propai ui: http://127.0.0.1:18789/"),
      ).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.PROPAICLAW_MODE;
      } else {
        process.env.PROPAICLAW_MODE = previous;
      }
    }
  });

  it("does not log control ui url when control ui is disabled", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {
        gateway: {
          controlUi: {
            enabled: false,
          },
        },
      },
      bindHost: "127.0.0.1",
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    expect(info.mock.calls.some((call) => String(call[0]).startsWith("control ui: "))).toBe(false);
  });
});
