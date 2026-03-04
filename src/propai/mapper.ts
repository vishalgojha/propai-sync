import { normalizeWhatsAppGroupAllowlistEntries } from "./group-allowlist.js";

const ANSI_BLUE_BOLD = "\x1b[1;34m";
const ANSI_RESET = "\x1b[0m";

export type PropAiCommandRoute =
  | {
      kind: "help";
      debug: boolean;
    }
  | {
      kind: "error";
      debug: boolean;
      message: string;
    }
  | {
      kind: "single";
      debug: boolean;
      commandLabel: string;
      args: string[];
    }
  | {
      kind: "multi";
      debug: boolean;
      commands: Array<{ commandLabel: string; args: string[] }>;
    }
  | {
      kind: "local";
      debug: boolean;
      commandLabel: "stop";
      params: Record<string, never>;
    }
  | {
      kind: "local";
      debug: boolean;
      commandLabel: "ui";
      params: {
        noOpen: boolean;
      };
    }
  | {
      kind: "local";
      debug: boolean;
      commandLabel: "profile-init";
      params: {
        brokerageName?: string;
        ownerName?: string;
        agentName?: string;
        timezone?: string;
        city?: string;
        focus?: string;
        workspaceDir?: string;
        overwrite: boolean;
      };
    }
  | {
      kind: "local";
      debug: boolean;
      commandLabel: "groups-list";
      params: {
        accountId?: string;
        agentId?: string;
      };
    }
  | {
      kind: "local";
      debug: boolean;
      commandLabel: "groups-allow";
      params: {
        groupIds: string[];
        accountId?: string;
        agentId?: string;
      };
    };

type RenderPropAiHelpOptions = {
  color?: boolean;
};

function colorizeCommandName(commandName: string, colorEnabled: boolean): string {
  if (!colorEnabled) {
    return commandName;
  }
  return `${ANSI_BLUE_BOLD}${commandName}${ANSI_RESET}`;
}

export function renderPropAiHelp(
  commandName = "propaiclaw",
  options: RenderPropAiHelpOptions = {},
): string {
  const colorEnabled = options.color ?? false;
  const styledCommandName = colorizeCommandName(commandName, colorEnabled);
  const cmd = (suffix: string) => `  ${styledCommandName} ${suffix}`;

  return [
    "Propaiclaw Realtor CLI",
    "",
    `Command: ${styledCommandName}`,
    "",
    "Quick start:",
    cmd("profile init [brokerage-name] [options]"),
    cmd("sync"),
    cmd("start"),
    cmd("stop"),
    cmd("connect whatsapp"),
    "",
    "Daily commands:",
    cmd("status"),
    cmd("history [target]"),
    cmd('lead follow-up <target> "<message>"'),
    cmd('schedule daily "<message>" --to <target>'),
    "",
    "Workspace commands:",
    cmd("dashboard"),
    cmd("ui"),
    cmd("tui"),
    cmd("setup"),
    cmd("channels list"),
    cmd("channels add <account-id> [options]"),
    cmd("channels remove <account-id>"),
    cmd("groups list [--account <id>] [--agent <id>]"),
    cmd("groups allow <group-id...> [--account <id>] [--agent <id>]"),
    cmd("groups allow-all [--account <id>] [--agent <id>]"),
    "",
    "Flags (global):",
    "  --debug   Show underlying runtime command and keep raw diagnostics",
    "  --admin   Enable advanced/developer passthrough commands",
    "",
    "Advanced (admin only):",
    cmd("--admin raw <runtime args...>"),
  ].join("\n");
}

type ParsedArgs = {
  debug: boolean;
  admin: boolean;
  tokens: string[];
};

function parseGlobalFlags(argv: string[]): ParsedArgs {
  const tokens: string[] = [];
  let debug = false;
  let admin = false;

  for (const token of argv) {
    if (token === "--debug") {
      debug = true;
      continue;
    }
    if (token === "--admin") {
      admin = true;
      continue;
    }
    tokens.push(token);
  }
  return { debug, admin, tokens };
}

function isHelpToken(token: string | undefined): boolean {
  return token === "-h" || token === "--help" || token === "help";
}

function hasOptionFlag(tokens: string[], name: string): boolean {
  if (tokens.includes(name)) {
    return true;
  }
  return tokens.some((token) => token.startsWith(`${name}=`));
}

function withDefaultWhatsappChannel(tokens: string[]): string[] {
  if (hasOptionFlag(tokens, "--channel")) {
    return tokens;
  }
  return ["--channel", "whatsapp", ...tokens];
}

type UiRouteParseResult =
  | {
      ok: true;
      noOpen: boolean;
    }
  | {
      ok: false;
      message: string;
    };

function parseUiRouteOptions(
  args: string[],
  commandName: string,
  subcommand: "ui" | "dashboard" | "web",
): UiRouteParseResult {
  const unsupported = args.filter((arg) => arg !== "--no-open");
  if (unsupported.length > 0) {
    return {
      ok: false,
      message: `Unsupported ${subcommand} arguments: ${unsupported.join(" ")}. Usage: ${commandName} ${subcommand} [--no-open]`,
    };
  }
  return {
    ok: true,
    noOpen: args.includes("--no-open"),
  };
}

type ParsedLongOptions = {
  options: Map<string, string | true>;
  positionals: string[];
  invalidOption: string | null;
};

function parseLongOptions(tokens: string[]): ParsedLongOptions {
  const options = new Map<string, string | true>();
  const positionals: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    if (!token.startsWith("-")) {
      positionals.push(token);
      continue;
    }
    if (!token.startsWith("--")) {
      return { options, positionals, invalidOption: token };
    }
    const eqIndex = token.indexOf("=");
    if (eqIndex > 0) {
      const key = token.slice(2, eqIndex).trim();
      const value = token.slice(eqIndex + 1);
      options.set(key, value);
      continue;
    }

    const key = token.slice(2).trim();
    const nextToken = tokens[index + 1];
    if (nextToken && !nextToken.startsWith("-")) {
      options.set(key, nextToken);
      index += 1;
      continue;
    }
    options.set(key, true);
  }

  return { options, positionals, invalidOption: null };
}

function readStringOption(
  options: Map<string, string | true>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = options.get(name);
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
    }
  }
  return undefined;
}

type GroupScopeParseResult =
  | {
      ok: true;
      accountId?: string;
      agentId?: string;
    }
  | {
      ok: false;
      message: string;
    };

function parseGroupScopeOptions(
  options: Map<string, string | true>,
  commandName: string,
): GroupScopeParseResult {
  const allowed = new Set(["account", "agent"]);
  for (const key of options.keys()) {
    if (!allowed.has(key)) {
      return {
        ok: false,
        message: `Unsupported option --${key}. Use: ${commandName} groups <list|allow|allow-all> [--account <id>] [--agent <id>]`,
      };
    }
  }

  const accountRaw = options.get("account");
  if (accountRaw === true) {
    return {
      ok: false,
      message: `Missing value for --account. Usage: ${commandName} groups allow <group-id...> --account <id>`,
    };
  }
  const agentRaw = options.get("agent");
  if (agentRaw === true) {
    return {
      ok: false,
      message: `Missing value for --agent. Usage: ${commandName} groups allow <group-id...> --agent <id>`,
    };
  }

  const accountId = readStringOption(options, "account");
  const agentId = readStringOption(options, "agent");
  return {
    ok: true,
    accountId,
    agentId,
  };
}

function buildDailyJobName(now: Date): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `propaiclaw-daily-${stamp}`;
}

function mapStatus(debug: boolean, options: string[]): PropAiCommandRoute {
  return {
    kind: "multi",
    debug,
    commands: [
      { commandLabel: "status", args: ["status", ...options] },
      { commandLabel: "health", args: ["health", ...options] },
    ],
  };
}

export function mapPropAiArgs(
  argv: string[],
  now: Date = new Date(),
  commandName = "propaiclaw",
): PropAiCommandRoute {
  const { debug, admin, tokens } = parseGlobalFlags(argv);
  const [primary, secondary, ...rest] = tokens;

  if (!primary || isHelpToken(primary)) {
    return { kind: "help", debug };
  }

  if (primary === "start") {
    const startArgs = [secondary, ...rest].filter((part): part is string => Boolean(part));
    return { kind: "single", debug, commandLabel: "start", args: ["gateway", "run", ...startArgs] };
  }

  if (primary === "stop") {
    const stopArgs = [secondary, ...rest].filter((part): part is string => Boolean(part));
    if (stopArgs.length > 0) {
      return {
        kind: "error",
        debug,
        message: `Unsupported stop arguments. Usage: ${commandName} stop`,
      };
    }
    return {
      kind: "local",
      debug,
      commandLabel: "stop",
      params: {},
    };
  }

  if (primary === "setup" || primary === "sync") {
    const setupArgs = [secondary, ...rest].filter((part): part is string => Boolean(part));
    const args = ["onboard"];
    if (!hasOptionFlag(setupArgs, "--flow")) {
      args.push("--flow", "quickstart");
    }
    if (!hasOptionFlag(setupArgs, "--skip-ui")) {
      args.push("--skip-ui");
    }
    args.push(...setupArgs);
    return { kind: "single", debug, commandLabel: primary, args };
  }

  if (primary === "ui") {
    const uiArgs = [secondary, ...rest].filter((part): part is string => Boolean(part));
    const parsed = parseUiRouteOptions(uiArgs, commandName, "ui");
    if (!parsed.ok) {
      return {
        kind: "error",
        debug,
        message: parsed.message,
      };
    }
    return {
      kind: "local",
      debug,
      commandLabel: "ui",
      params: {
        noOpen: parsed.noOpen,
      },
    };
  }

  if (primary === "dashboard" || primary === "web") {
    const dashboardArgs = [secondary, ...rest].filter((part): part is string => Boolean(part));
    const parsed = parseUiRouteOptions(dashboardArgs, commandName, primary);
    if (!parsed.ok) {
      return {
        kind: "error",
        debug,
        message: parsed.message,
      };
    }
    return {
      kind: "local",
      debug,
      commandLabel: "ui",
      params: {
        noOpen: parsed.noOpen,
      },
    };
  }

  if (primary === "tui" || primary === "chat") {
    const tuiArgs = [secondary, ...rest].filter((part): part is string => Boolean(part));
    return {
      kind: "single",
      debug,
      commandLabel: "tui",
      args: ["tui", ...tuiArgs],
    };
  }

  if (primary === "profile") {
    if (secondary !== "init") {
      return {
        kind: "error",
        debug,
        message: `Unsupported profile command. Use: ${commandName} profile init [brokerage-name] [options]`,
      };
    }

    const parsed = parseLongOptions(rest);
    if (parsed.invalidOption) {
      return {
        kind: "error",
        debug,
        message: `Unsupported option format: ${parsed.invalidOption}. Use long options like --owner "Name".`,
      };
    }

    if (parsed.positionals.length > 1) {
      return {
        kind: "error",
        debug,
        message: `Too many positional values. Usage: ${commandName} profile init [brokerage-name] [--owner ... --agent-name ...]`,
      };
    }

    const brokerageName =
      readStringOption(parsed.options, "brokerage", "team") ?? parsed.positionals[0]?.trim();
    const ownerName = readStringOption(parsed.options, "owner");
    const agentName = readStringOption(parsed.options, "agent-name", "agent");
    const timezone = readStringOption(parsed.options, "timezone", "tz");
    const city = readStringOption(parsed.options, "city");
    const focus = readStringOption(parsed.options, "focus");
    const workspaceDir = readStringOption(parsed.options, "workspace");
    const overwrite = parsed.options.get("overwrite") === true;

    return {
      kind: "local",
      debug,
      commandLabel: "profile-init",
      params: {
        brokerageName,
        ownerName,
        agentName,
        timezone,
        city,
        focus,
        workspaceDir,
        overwrite,
      },
    };
  }

  if (primary === "status") {
    return mapStatus(
      debug,
      [secondary, ...rest].filter((part): part is string => Boolean(part)),
    );
  }

  if (primary === "connect") {
    const app = secondary?.trim().toLowerCase();
    if (!app) {
      return {
        kind: "error",
        debug,
        message: `Missing app name. Usage: ${commandName} connect whatsapp`,
      };
    }
    if (app !== "whatsapp") {
      return {
        kind: "error",
        debug,
        message: `Only WhatsApp is supported right now. Usage: ${commandName} connect whatsapp`,
      };
    }
    return {
      kind: "single",
      debug,
      commandLabel: "connect",
      args: ["channels", "login", "--channel", "whatsapp", ...rest],
    };
  }

  if (primary === "channels") {
    if (secondary === "list") {
      return {
        kind: "single",
        debug,
        commandLabel: "channels-list",
        args: ["channels", "list", ...rest],
      };
    }

    if (secondary === "add") {
      const accountId = rest[0]?.trim();
      const passthrough = rest.slice(1);
      if (!accountId) {
        return {
          kind: "error",
          debug,
          message: `Missing account id. Usage: ${commandName} channels add <account-id> [options]`,
        };
      }
      return {
        kind: "single",
        debug,
        commandLabel: "channels-add",
        args: ["channels", "add", "--channel", "whatsapp", "--account", accountId, ...passthrough],
      };
    }

    if (secondary === "remove") {
      const accountId = rest[0]?.trim();
      const passthrough = rest.slice(1);
      if (!accountId) {
        return {
          kind: "error",
          debug,
          message: `Missing account id. Usage: ${commandName} channels remove <account-id>`,
        };
      }
      return {
        kind: "single",
        debug,
        commandLabel: "channels-remove",
        args: [
          "channels",
          "remove",
          "--channel",
          "whatsapp",
          "--account",
          accountId,
          ...passthrough,
        ],
      };
    }

    return {
      kind: "error",
      debug,
      message: `Unsupported channels command. Use: ${commandName} channels <list|add|remove>`,
    };
  }

  if (primary === "groups") {
    if (secondary === "list") {
      const parsed = parseLongOptions(rest);
      if (parsed.invalidOption) {
        return {
          kind: "error",
          debug,
          message: `Unsupported option format: ${parsed.invalidOption}. Use long options like --account tenant-a.`,
        };
      }
      if (parsed.positionals.length > 0) {
        return {
          kind: "error",
          debug,
          message: `Unexpected argument(s): ${parsed.positionals.join(" ")}. Usage: ${commandName} groups list [--account <id>] [--agent <id>]`,
        };
      }
      const scope = parseGroupScopeOptions(parsed.options, commandName);
      if (!scope.ok) {
        return { kind: "error", debug, message: scope.message };
      }
      return {
        kind: "local",
        debug,
        commandLabel: "groups-list",
        params: {
          accountId: scope.accountId,
          agentId: scope.agentId,
        },
      };
    }

    if (secondary === "allow" || secondary === "add") {
      const parsed = parseLongOptions(rest);
      if (parsed.invalidOption) {
        return {
          kind: "error",
          debug,
          message: `Unsupported option format: ${parsed.invalidOption}. Use long options like --account tenant-a.`,
        };
      }
      const scope = parseGroupScopeOptions(parsed.options, commandName);
      if (!scope.ok) {
        return { kind: "error", debug, message: scope.message };
      }
      const groupIds = normalizeWhatsAppGroupAllowlistEntries(parsed.positionals);
      if (groupIds.length === 0) {
        return {
          kind: "error",
          debug,
          message: `Missing group id. Usage: ${commandName} groups allow <group-id...>`,
        };
      }
      return {
        kind: "local",
        debug,
        commandLabel: "groups-allow",
        params: {
          groupIds,
          accountId: scope.accountId,
          agentId: scope.agentId,
        },
      };
    }

    if (secondary === "allow-all") {
      const parsed = parseLongOptions(rest);
      if (parsed.invalidOption) {
        return {
          kind: "error",
          debug,
          message: `Unsupported option format: ${parsed.invalidOption}. Use long options like --account tenant-a.`,
        };
      }
      if (parsed.positionals.length > 0) {
        return {
          kind: "error",
          debug,
          message: `Unexpected argument(s): ${parsed.positionals.join(" ")}. Usage: ${commandName} groups allow-all [--account <id>] [--agent <id>]`,
        };
      }
      const scope = parseGroupScopeOptions(parsed.options, commandName);
      if (!scope.ok) {
        return { kind: "error", debug, message: scope.message };
      }
      return {
        kind: "local",
        debug,
        commandLabel: "groups-allow",
        params: {
          groupIds: ["*"],
          accountId: scope.accountId,
          agentId: scope.agentId,
        },
      };
    }

    return {
      kind: "error",
      debug,
      message: `Unsupported groups command. Use: ${commandName} groups <list|allow|allow-all>`,
    };
  }

  if (primary === "lead") {
    if (secondary !== "follow-up") {
      return {
        kind: "error",
        debug,
        message: `Unsupported lead command. Use: ${commandName} lead follow-up <target> "<message>"`,
      };
    }
    const target = rest[0]?.trim();
    const message = rest[1];
    const passthrough = rest.slice(2);
    if (!target || !message) {
      return {
        kind: "error",
        debug,
        message: `Missing follow-up target or message. Usage: ${commandName} lead follow-up <target> "<message>"`,
      };
    }
    return {
      kind: "single",
      debug,
      commandLabel: "lead-follow-up",
      args: [
        "message",
        "send",
        "--target",
        target,
        "--message",
        message,
        ...withDefaultWhatsappChannel(passthrough),
      ],
    };
  }

  if (primary === "history") {
    const maybeTarget = secondary;
    if (maybeTarget && !maybeTarget.startsWith("-")) {
      return {
        kind: "single",
        debug,
        commandLabel: "history-target",
        args: ["message", "read", "--target", maybeTarget, ...withDefaultWhatsappChannel(rest)],
      };
    }
    return {
      kind: "single",
      debug,
      commandLabel: "history",
      args: ["sessions", secondary, ...rest].filter((part): part is string => Boolean(part)),
    };
  }

  if (primary === "schedule") {
    if (secondary !== "daily") {
      return {
        kind: "error",
        debug,
        message: `Unsupported schedule command. Use: ${commandName} schedule daily "<message>" --to <target>`,
      };
    }
    const message = rest[0];
    const options = rest.slice(1);
    if (!message) {
      return {
        kind: "error",
        debug,
        message: `Missing daily message. Usage: ${commandName} schedule daily "<message>" --to <target>`,
      };
    }
    if (!hasOptionFlag(options, "--to")) {
      return {
        kind: "error",
        debug,
        message: `Missing destination. Usage: ${commandName} schedule daily "<message>" --to <target>`,
      };
    }
    const scheduleOptions = withDefaultWhatsappChannel(options);
    const args = [
      "cron",
      "add",
      "--every",
      "1d",
      "--message",
      message,
      "--session",
      "isolated",
      "--announce",
    ];
    if (!hasOptionFlag(options, "--name")) {
      args.push("--name", buildDailyJobName(now));
    }
    args.push(...scheduleOptions);
    return {
      kind: "single",
      debug,
      commandLabel: "schedule-daily",
      args,
    };
  }

  if (primary === "raw") {
    if (!admin) {
      return {
        kind: "error",
        debug,
        message: `Advanced passthrough is disabled. Use: ${commandName} --admin raw <runtime args...>`,
      };
    }
    if (!secondary) {
      return {
        kind: "error",
        debug,
        message: `Missing runtime arguments. Usage: ${commandName} raw <runtime args...>`,
      };
    }
    return {
      kind: "single",
      debug,
      commandLabel: "raw",
      args: [secondary, ...rest],
    };
  }

  return {
    kind: "error",
    debug,
    message: `Unknown command: ${primary}. Run "${commandName} --help".`,
  };
}

export function renderFriendlyFailure(commandLabel: string, commandName = "propaiclaw"): string {
  switch (commandLabel) {
    case "start":
      return `Propaiclaw could not start your AI engine. Try \`${commandName} start --debug\` for full diagnostics.`;
    case "stop":
      return `Propaiclaw could not stop old sessions. Try \`${commandName} stop --debug\` for full diagnostics.`;
    case "setup":
    case "sync":
      return `Propaiclaw setup could not complete. Re-run with \`${commandName} sync --debug\` for raw diagnostics.`;
    case "dashboard":
    case "ui":
      return `Propaiclaw could not open the PropAI UI. Confirm the gateway is running with \`${commandName} start\`, then retry.`;
    case "tui":
      return `Propaiclaw could not start TUI mode. Confirm the gateway is running with \`${commandName} start\`, then retry.`;
    case "connect":
      return `Propaiclaw could not connect WhatsApp. Confirm your AI engine is running with \`${commandName} status\`, then retry.`;
    case "channels-add":
      return "Propaiclaw could not add the WhatsApp team channel. Re-run with `--debug` and verify your account id is valid.";
    case "channels-list":
      return `Propaiclaw could not list channel accounts. Confirm your AI engine is running with \`${commandName} status\`.`;
    case "channels-remove":
      return "Propaiclaw could not remove the WhatsApp team channel. Re-run with `--debug` and confirm the account id exists.";
    case "groups-list":
      return `Propaiclaw could not list WhatsApp groups. Confirm your account is linked with \`${commandName} connect whatsapp\`, then retry.`;
    case "groups-allow":
      return "Propaiclaw could not update the WhatsApp group allowlist. Re-run with `--debug` to inspect the failure.";
    case "lead-follow-up":
      return `Propaiclaw could not send the follow-up. Confirm your connection with \`${commandName} status\`, then retry.`;
    case "schedule-daily":
      return "Propaiclaw could not create the daily follow-up schedule. Run with `--debug` to inspect the underlying cron command.";
    case "profile-init":
      return "Propaiclaw could not initialize the realtor workspace profile. Re-run with `--debug` for diagnostics.";
    case "history":
    case "history-target":
      return "Propaiclaw could not load conversation history. Ensure your AI engine is running, then retry.";
    case "status":
    case "health":
      return `Propaiclaw could not fetch status. Start the service first with \`${commandName} start\`.`;
    default:
      return "Propaiclaw command failed. Re-run with `--debug` for raw runtime output.";
  }
}
