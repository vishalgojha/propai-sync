import { describe, expect, it } from "vitest";
import { mapPropAiArgs, renderFriendlyFailure, renderPropAiHelp } from "./mapper.js";

describe("mapPropAiArgs", () => {
  it("returns help for empty args", () => {
    const route = mapPropAiArgs([]);
    expect(route).toEqual({ kind: "help", debug: false });
  });

  it("maps start to gateway run", () => {
    const route = mapPropAiArgs(["start", "--port", "18789"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "start",
      args: ["gateway", "run", "--port", "18789"],
    });
  });

  it("maps stop to local stale-session cleanup", () => {
    const route = mapPropAiArgs(["stop"]);
    expect(route).toEqual({
      kind: "local",
      debug: false,
      commandLabel: "stop",
      params: {},
    });
  });

  it("errors when stop receives unsupported args", () => {
    const route = mapPropAiArgs(["stop", "--force"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message: "Unsupported stop arguments. Usage: propaiclaw stop",
    });
  });

  it("maps setup to onboard", () => {
    const route = mapPropAiArgs(["setup"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "setup",
      args: ["onboard", "--flow", "quickstart", "--skip-ui"],
    });
  });

  it("maps sync to onboard", () => {
    const route = mapPropAiArgs(["sync"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "sync",
      args: ["onboard", "--flow", "quickstart", "--skip-ui"],
    });
  });

  it("respects explicit setup flow flags", () => {
    const route = mapPropAiArgs(["setup", "--flow", "advanced", "--skip-ui"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "setup",
      args: ["onboard", "--flow", "advanced", "--skip-ui"],
    });
  });

  it("maps dashboard shortcut", () => {
    const route = mapPropAiArgs(["dashboard"]);
    expect(route).toEqual({
      kind: "local",
      debug: false,
      commandLabel: "ui",
      params: {
        noOpen: false,
      },
    });
  });

  it("maps ui shortcut to local ui opener", () => {
    const route = mapPropAiArgs(["ui"]);
    expect(route).toEqual({
      kind: "local",
      debug: false,
      commandLabel: "ui",
      params: {
        noOpen: false,
      },
    });
  });

  it("maps ui --no-open", () => {
    const route = mapPropAiArgs(["ui", "--no-open"]);
    expect(route).toEqual({
      kind: "local",
      debug: false,
      commandLabel: "ui",
      params: {
        noOpen: true,
      },
    });
  });

  it("maps dashboard --no-open", () => {
    const route = mapPropAiArgs(["dashboard", "--no-open"]);
    expect(route).toEqual({
      kind: "local",
      debug: false,
      commandLabel: "ui",
      params: {
        noOpen: true,
      },
    });
  });

  it("errors when ui receives unsupported args", () => {
    const route = mapPropAiArgs(["ui", "--open"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message: "Unsupported ui arguments: --open. Usage: propaiclaw ui [--no-open]",
    });
  });

  it("maps tui shortcut", () => {
    const route = mapPropAiArgs(["tui", "--deliver"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "tui",
      args: ["tui", "--deliver"],
    });
  });

  it("maps connect command", () => {
    const route = mapPropAiArgs(["connect", "whatsapp", "--account", "primary"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "connect",
      args: ["channels", "login", "--channel", "whatsapp", "--account", "primary"],
    });
  });

  it("errors when connect app is missing", () => {
    const route = mapPropAiArgs(["connect"]);
    expect(route.kind).toBe("error");
  });

  it("rejects non-whatsapp connect targets", () => {
    const route = mapPropAiArgs(["connect", "telegram"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message: "Only WhatsApp is supported right now. Usage: propaiclaw connect whatsapp",
    });
  });

  it("renders error usage with the active command name", () => {
    const route = mapPropAiArgs(
      ["connect", "telegram"],
      new Date("2026-03-01T08:00:00.000Z"),
      "propai",
    );
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message: "Only WhatsApp is supported right now. Usage: propai connect whatsapp",
    });
  });

  it("maps channels list", () => {
    const route = mapPropAiArgs(["channels", "list", "--json"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "channels-list",
      args: ["channels", "list", "--json"],
    });
  });

  it("maps channels add to whatsapp account shortcut", () => {
    const route = mapPropAiArgs(["channels", "add", "team2", "--name", "Team Phone 2"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "channels-add",
      args: [
        "channels",
        "add",
        "--channel",
        "whatsapp",
        "--account",
        "team2",
        "--name",
        "Team Phone 2",
      ],
    });
  });

  it("errors when channels add account id is missing", () => {
    const route = mapPropAiArgs(["channels", "add"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message: "Missing account id. Usage: propaiclaw channels add <account-id> [options]",
    });
  });

  it("maps channels remove to whatsapp account shortcut", () => {
    const route = mapPropAiArgs(["channels", "remove", "team2"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "channels-remove",
      args: ["channels", "remove", "--channel", "whatsapp", "--account", "team2"],
    });
  });

  it("errors when channels remove account id is missing", () => {
    const route = mapPropAiArgs(["channels", "remove"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message: "Missing account id. Usage: propaiclaw channels remove <account-id>",
    });
  });

  it("errors on unsupported channels subcommand", () => {
    const route = mapPropAiArgs(["channels", "status"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message: "Unsupported channels command. Use: propaiclaw channels <list|add|remove>",
    });
  });

  it("maps groups list to directory command", () => {
    const route = mapPropAiArgs(["groups", "list"]);
    expect(route).toEqual({
      kind: "local",
      debug: false,
      commandLabel: "groups-list",
      params: {
        accountId: undefined,
        agentId: undefined,
      },
    });
  });

  it("maps groups list with account/agent scope options", () => {
    const route = mapPropAiArgs(["groups", "list", "--account", "tenant-a", "--agent", "realtor"]);
    expect(route).toEqual({
      kind: "local",
      debug: false,
      commandLabel: "groups-list",
      params: {
        accountId: "tenant-a",
        agentId: "realtor",
      },
    });
  });

  it("errors when groups list receives unexpected positional args", () => {
    const route = mapPropAiArgs(["groups", "list", "extra"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message:
        "Unexpected argument(s): extra. Usage: propaiclaw groups list [--account <id>] [--agent <id>]",
    });
  });

  it("maps groups allow to local allowlist update", () => {
    const route = mapPropAiArgs([
      "groups",
      "allow",
      "120000000000001@g.us",
      "120000000000002@g.us",
    ]);
    expect(route).toEqual({
      kind: "local",
      debug: false,
      commandLabel: "groups-allow",
      params: {
        groupIds: ["120000000000001@g.us", "120000000000002@g.us"],
        accountId: undefined,
        agentId: undefined,
      },
    });
  });

  it("maps groups allow with account scope option", () => {
    const route = mapPropAiArgs(["groups", "allow", "Family Investors", "--account", "tenant-a"]);
    expect(route).toEqual({
      kind: "local",
      debug: false,
      commandLabel: "groups-allow",
      params: {
        groupIds: ["Family Investors"],
        accountId: "tenant-a",
        agentId: undefined,
      },
    });
  });

  it("maps groups allow-all to wildcard allowlist", () => {
    const route = mapPropAiArgs(["groups", "allow-all"]);
    expect(route).toEqual({
      kind: "local",
      debug: false,
      commandLabel: "groups-allow",
      params: {
        groupIds: ["*"],
        accountId: undefined,
        agentId: undefined,
      },
    });
  });

  it("errors when groups allow is missing group ids", () => {
    const route = mapPropAiArgs(["groups", "allow"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message: "Missing group id. Usage: propaiclaw groups allow <group-id...>",
    });
  });

  it("errors when groups allow uses an unsupported option", () => {
    const route = mapPropAiArgs(["groups", "allow", "Family Investors", "--query", "family"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message:
        "Unsupported option --query. Use: propaiclaw groups <list|allow|allow-all> [--account <id>] [--agent <id>]",
    });
  });

  it("errors when --account is provided without value", () => {
    const route = mapPropAiArgs(["groups", "allow", "Family Investors", "--account"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message:
        "Missing value for --account. Usage: propaiclaw groups allow <group-id...> --account <id>",
    });
  });

  it("maps lead follow-up to message send", () => {
    const route = mapPropAiArgs(["lead", "follow-up", "+15555550123", "Checking in"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "lead-follow-up",
      args: [
        "message",
        "send",
        "--target",
        "+15555550123",
        "--message",
        "Checking in",
        "--channel",
        "whatsapp",
      ],
    });
  });

  it("errors for invalid lead command", () => {
    const route = mapPropAiArgs(["lead", "list"]);
    expect(route.kind).toBe("error");
  });

  it("maps history with target to message read", () => {
    const route = mapPropAiArgs(["history", "+15555550123", "--limit", "25"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "history-target",
      args: [
        "message",
        "read",
        "--target",
        "+15555550123",
        "--channel",
        "whatsapp",
        "--limit",
        "25",
      ],
    });
  });

  it("maps history without target to sessions", () => {
    const route = mapPropAiArgs(["history"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "history",
      args: ["sessions"],
    });
  });

  it("maps status to status+health chain", () => {
    const route = mapPropAiArgs(["status"]);
    expect(route).toEqual({
      kind: "multi",
      debug: false,
      commands: [
        { commandLabel: "status", args: ["status"] },
        { commandLabel: "health", args: ["health"] },
      ],
    });
  });

  it("passes status flags through to both status and health", () => {
    const route = mapPropAiArgs(["status", "--json"]);
    expect(route).toEqual({
      kind: "multi",
      debug: false,
      commands: [
        { commandLabel: "status", args: ["status", "--json"] },
        { commandLabel: "health", args: ["health", "--json"] },
      ],
    });
  });

  it("maps schedule daily and injects defaults", () => {
    const route = mapPropAiArgs(
      ["schedule", "daily", "Morning follow-up", "--to", "+15555550123", "--channel", "whatsapp"],
      new Date("2026-03-01T08:00:00.000Z"),
    );
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "schedule-daily",
      args: [
        "cron",
        "add",
        "--every",
        "1d",
        "--message",
        "Morning follow-up",
        "--session",
        "isolated",
        "--announce",
        "--name",
        "propaiclaw-daily-20260301T080000Z",
        "--to",
        "+15555550123",
        "--channel",
        "whatsapp",
      ],
    });
  });

  it("requires --to for schedule daily", () => {
    const route = mapPropAiArgs(["schedule", "daily", "Morning follow-up"]);
    expect(route.kind).toBe("error");
  });

  it("preserves explicit schedule name", () => {
    const route = mapPropAiArgs(
      ["schedule", "daily", "Morning follow-up", "--name", "custom-job", "--to", "+15555550123"],
      new Date("2026-03-01T08:00:00.000Z"),
    );
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "schedule-daily",
      args: [
        "cron",
        "add",
        "--every",
        "1d",
        "--message",
        "Morning follow-up",
        "--session",
        "isolated",
        "--announce",
        "--channel",
        "whatsapp",
        "--name",
        "custom-job",
        "--to",
        "+15555550123",
      ],
    });
  });

  it("maps raw passthrough command", () => {
    const route = mapPropAiArgs(["--admin", "raw", "skills", "list", "--eligible"]);
    expect(route).toEqual({
      kind: "single",
      debug: false,
      commandLabel: "raw",
      args: ["skills", "list", "--eligible"],
    });
  });

  it("blocks raw passthrough without --admin", () => {
    const route = mapPropAiArgs(["raw", "skills", "list"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message: "Advanced passthrough is disabled. Use: propaiclaw --admin raw <runtime args...>",
    });
  });

  it("requires runtime args for raw passthrough", () => {
    const route = mapPropAiArgs(["--admin", "raw"]);
    expect(route).toEqual({
      kind: "error",
      debug: false,
      message: "Missing runtime arguments. Usage: propaiclaw raw <runtime args...>",
    });
  });

  it("maps profile init to local workspace profile command", () => {
    const route = mapPropAiArgs([
      "profile",
      "init",
      "Acme Realty",
      "--owner",
      "Vishal",
      "--city",
      "Miami",
      "--overwrite",
    ]);
    expect(route).toEqual({
      kind: "local",
      debug: false,
      commandLabel: "profile-init",
      params: {
        brokerageName: "Acme Realty",
        ownerName: "Vishal",
        city: "Miami",
        agentName: undefined,
        timezone: undefined,
        focus: undefined,
        workspaceDir: undefined,
        overwrite: true,
      },
    });
  });

  it("errors on unsupported profile subcommand", () => {
    const route = mapPropAiArgs(["profile", "list"]);
    expect(route.kind).toBe("error");
  });

  it("tracks debug flag globally", () => {
    const route = mapPropAiArgs(["--debug", "start"]);
    expect(route).toEqual({
      kind: "single",
      debug: true,
      commandLabel: "start",
      args: ["gateway", "run"],
    });
  });
});

describe("propaiclaw help and failures", () => {
  it("renders help text with core commands", () => {
    const help = renderPropAiHelp();
    expect(help).toContain("propaiclaw profile init");
    expect(help).toContain("propaiclaw start");
    expect(help).toContain("propaiclaw stop");
    expect(help).toContain("propaiclaw sync");
    expect(help).toContain("propaiclaw dashboard");
    expect(help).toContain("propaiclaw tui");
    expect(help).toContain("propaiclaw lead follow-up");
    expect(help).toContain("propaiclaw schedule daily");
    expect(help).toContain("propaiclaw channels add");
    expect(help).toContain("propaiclaw channels list");
    expect(help).toContain("propaiclaw groups allow");
    expect(help).toContain("--admin");
    expect(help.toLowerCase()).not.toContain("openclaw");
  });

  it("renders friendly failure text", () => {
    expect(renderFriendlyFailure("connect")).toContain("could not connect");
    expect(renderFriendlyFailure("dashboard")).toContain("could not open the PropAI UI");
    expect(renderFriendlyFailure("ui")).toContain("could not open the PropAI UI");
    expect(renderFriendlyFailure("tui")).toContain("could not start TUI mode");
    expect(renderFriendlyFailure("stop")).toContain("could not stop old sessions");
    const unknownFailure = renderFriendlyFailure("unknown");
    expect(unknownFailure).toContain("command failed");
    expect(unknownFailure.toLowerCase()).not.toContain("openclaw");
  });
});
