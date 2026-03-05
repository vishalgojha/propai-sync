import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Cron } from "croner";
import { maskServiceKey } from "./crypto.js";
import {
  assertValidUserId,
  resolveHostedUserRuntimeStateRoot,
  resolveHostedUserWorkspaceRoot,
} from "./paths.js";
import { HostedPlatformStore } from "./store.js";
import type {
  ApiAccessKeyRecord,
  ApiKeyAuthResult,
  HostedAgentDefinition,
  HostedAgentResult,
  HostedOrchestrateMode,
  HostedOrchestrateResult,
  HostedRecipe,
  HostedRecipeStep,
  HostedToolDefinition,
  HostedToolExecutionContext,
  HostedToolExecutionResult,
  HostedTrigger,
  HostedTriggerType,
} from "./types.js";

const DEFAULT_CLI_TIMEOUT_MS = 120_000;
const MAX_CAPTURED_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_ROUTER_MODEL = "gpt-4o-mini";

type RegisteredTool = HostedToolDefinition & {
  execute: (props: Record<string, unknown>, context: HostedToolExecutionContext) => Promise<unknown>;
};

type RuntimeAgent = HostedAgentDefinition & {
  execute: (params: {
    userId: string;
    task: string;
    input?: unknown;
    runTool: (toolKey: string, props?: Record<string, unknown>) => Promise<unknown>;
    runRecipe: (slug: string, input?: unknown) => Promise<unknown>;
  }) => Promise<unknown>;
};

type CliRunResult = {
  command: string[];
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || String(error);
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function normalizeTimeout(value: unknown, fallback = DEFAULT_CLI_TIMEOUT_MS): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1_000, Math.floor(value));
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`${fieldName} must be an array of strings`);
  }
  return value.map((entry) => entry.trim()).filter(Boolean);
}

function resolvePackageRoot(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "..", "..");
}

function routeTaskHeuristically(task: string): {
  mode: HostedOrchestrateMode;
  pipeline: string[];
  router: "heuristic";
} {
  const lower = task.toLowerCase();
  const selected = new Set<string>();
  if (/(sync|setup|onboard)/.test(lower)) {
    selected.add("sync-agent");
  }
  if (/(connect|channel|whatsapp|start|stop|status)/.test(lower)) {
    selected.add("channel-agent");
  }
  if (/(recipe|workflow|trigger)/.test(lower)) {
    selected.add("workflow-agent");
  }
  if (selected.size === 0) {
    selected.add("lead-agent");
  }
  const pipeline = [...selected];
  const mode: HostedOrchestrateMode =
    pipeline.length > 1 && /(parallel|in parallel|simultaneous|and)/.test(lower)
      ? "parallel"
      : "sequential";
  return { mode, pipeline, router: "heuristic" };
}

function resolvePathValue(source: unknown, selector: string): unknown {
  if (!selector) {
    return source;
  }
  const tokens = selector
    .split(".")
    .map((entry) => entry.trim())
    .filter(Boolean);
  let current: unknown = source;
  for (const token of tokens) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

function interpolateValue(value: unknown, ctx: { prev: unknown; input: unknown }): unknown {
  if (typeof value === "string") {
    if (value === "$prev") {
      return ctx.prev;
    }
    if (value === "$input") {
      return ctx.input;
    }
    return value.replace(/\$(prev|input)(\.[A-Za-z0-9_.-]+)?/g, (full, root, selector) => {
      const source = root === "prev" ? ctx.prev : ctx.input;
      const resolved = resolvePathValue(source, typeof selector === "string" ? selector.slice(1) : "");
      if (resolved === undefined || resolved === null) {
        return "";
      }
      if (typeof resolved === "string" || typeof resolved === "number" || typeof resolved === "boolean") {
        return String(resolved);
      }
      return JSON.stringify(resolved);
    });
  }
  if (Array.isArray(value)) {
    return value.map((entry) => interpolateValue(entry, ctx));
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = interpolateValue(entry, ctx);
    }
    return out;
  }
  return value;
}

function renderByFormatGuide(value: unknown, formatGuide: string | undefined): unknown {
  if (!formatGuide) {
    return value;
  }
  const normalized = formatGuide.trim().toLowerCase();
  if (!normalized) {
    return value;
  }
  if (normalized.includes("json")) {
    return JSON.stringify(value, null, 2);
  }
  if (normalized.includes("text") || normalized.includes("markdown")) {
    if (typeof value === "string") {
      return value;
    }
    return JSON.stringify(value, null, 2);
  }
  return value;
}

function parseFirstJsonObject(text: string): Record<string, unknown> | null {
  const direct = text.trim();
  if (!direct) {
    return null;
  }
  try {
    const parsed = JSON.parse(direct) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    // fall through
  }
  const start = direct.indexOf("{");
  const end = direct.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const parsed = JSON.parse(direct.slice(start, end + 1)) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function appendOutputChunk(current: string, chunk: Buffer): string {
  const next = current + chunk.toString("utf8");
  if (next.length <= MAX_CAPTURED_OUTPUT_BYTES) {
    return next;
  }
  return next.slice(next.length - MAX_CAPTURED_OUTPUT_BYTES);
}

export class HostedPlatformRuntime {
  private readonly store: HostedPlatformStore;
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly cronJobs = new Map<string, Cron>();
  private initialized = false;
  private readonly packageRoot = resolvePackageRoot();
  private readonly propaiEntryPath = path.join(this.packageRoot, "propai.mjs");

  constructor(store?: HostedPlatformStore) {
    this.store = store ?? new HostedPlatformStore();
    this.registerBuiltInTools();
  }

  getStore(): HostedPlatformStore {
    return this.store;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.store.ensureBaseDirectories();
    await this.scheduleAllCronTriggers();
    this.initialized = true;
  }

  async bootstrapApiAccess(params: {
    userId: string;
    label?: string;
  }): Promise<{ apiKey: string; record: ApiAccessKeyRecord }> {
    await this.initialize();
    const created = await this.store.createApiAccessKey(params);
    await this.store.appendLog({
      userId: created.record.userId,
      type: "orchestrate",
      message: "Bootstrap API key created",
      payload: { keyId: created.record.id, label: created.record.label },
    });
    return { apiKey: created.plainText, record: created.record };
  }

  async authenticateApiKey(apiKey: string): Promise<ApiKeyAuthResult | null> {
    await this.initialize();
    if (!apiKey.trim()) {
      return null;
    }
    return this.store.authenticateApiKey(apiKey.trim());
  }

  async listKeySummary(userId: string): Promise<{
    apiKeys: Array<Pick<ApiAccessKeyRecord, "id" | "label" | "createdAt" | "lastUsedAt">>;
    serviceKeys: ReturnType<typeof maskServiceKey>[];
  }> {
    const normalizedUserId = assertValidUserId(userId);
    const [apiKeys, serviceKeys] = await Promise.all([
      this.store.listApiAccessKeys(normalizedUserId),
      this.store.listServiceKeys(normalizedUserId),
    ]);
    return {
      apiKeys: apiKeys.map((entry) => ({
        id: entry.id,
        label: entry.label,
        createdAt: entry.createdAt,
        lastUsedAt: entry.lastUsedAt,
      })),
      serviceKeys: serviceKeys.map((entry) => maskServiceKey(entry)),
    };
  }

  async saveServiceKey(params: {
    userId: string;
    service: string;
    label?: string;
    plainTextKey: string;
  }): Promise<ReturnType<typeof maskServiceKey>> {
    const saved = await this.store.upsertServiceKey(params);
    await this.store.appendLog({
      userId: saved.userId,
      type: "orchestrate",
      message: `Saved BYOK key for service ${saved.service}`,
      payload: { keyId: saved.id, label: saved.label },
    });
    return maskServiceKey(saved);
  }

  async deleteKey(userId: string, keyId: string): Promise<{ deleted: boolean; kind?: string }> {
    const normalizedUserId = assertValidUserId(userId);
    const serviceDeleted = await this.store.deleteServiceKey(normalizedUserId, keyId);
    if (serviceDeleted) {
      return { deleted: true, kind: "service" };
    }
    const apiDeleted = await this.store.deleteApiAccessKey(normalizedUserId, keyId);
    if (apiDeleted) {
      return { deleted: true, kind: "access" };
    }
    return { deleted: false };
  }

  listTools(): HostedToolDefinition[] {
    return [...this.tools.values()].map(({ execute: _execute, ...meta }) => meta);
  }

  private registerTool(definition: RegisteredTool): void {
    this.tools.set(definition.key, definition);
  }

  private registerBuiltInTools(): void {
    const registerCliTool = (
      key: string,
      name: string,
      description: string,
      args: string[],
      schema: Record<string, unknown>,
    ) => {
      this.registerTool({
        key,
        name,
        service: "propai-cli",
        description,
        inputSchema: schema,
        execute: async (props, context) => {
          const timeoutMs = normalizeTimeout(props.timeoutMs);
          return this.runCliForUser(context.userId, args, timeoutMs);
        },
      });
    };

    registerCliTool(
      "propai.sync",
      "PropAI Sync",
      "Run `propai sync` (onboarding and quick setup).",
      ["sync"],
      {
        type: "object",
        properties: {
          timeoutMs: { type: "number", description: "Command timeout in milliseconds." },
        },
        additionalProperties: false,
      },
    );
    registerCliTool(
      "propai.start",
      "PropAI Start",
      "Run `propai start` (start gateway runtime).",
      ["start"],
      {
        type: "object",
        properties: {
          timeoutMs: { type: "number" },
        },
        additionalProperties: false,
      },
    );
    registerCliTool(
      "propai.stop",
      "PropAI Stop",
      "Run `propai stop` (stop gateway runtime).",
      ["stop"],
      {
        type: "object",
        properties: {
          timeoutMs: { type: "number" },
        },
        additionalProperties: false,
      },
    );
    registerCliTool(
      "propai.status",
      "PropAI Status",
      "Run `propai status` and return command output.",
      ["status"],
      {
        type: "object",
        properties: {
          timeoutMs: { type: "number" },
        },
        additionalProperties: false,
      },
    );
    registerCliTool(
      "propai.connect_whatsapp",
      "Connect WhatsApp",
      "Run `propai connect whatsapp`.",
      ["connect", "whatsapp"],
      {
        type: "object",
        properties: {
          timeoutMs: { type: "number" },
        },
        additionalProperties: false,
      },
    );

    this.registerTool({
      key: "propai.raw",
      name: "PropAI Raw",
      service: "propai-cli",
      description: "Run any PropAI CLI command as args array.",
      inputSchema: {
        type: "object",
        properties: {
          args: {
            type: "array",
            items: { type: "string" },
            description: 'CLI args, for example: ["channels","list"]',
          },
          timeoutMs: { type: "number" },
        },
        required: ["args"],
        additionalProperties: false,
      },
      execute: async (props, context) => {
        const args = readStringArray(props.args, "args");
        const timeoutMs = normalizeTimeout(props.timeoutMs);
        return this.runCliForUser(context.userId, args, timeoutMs);
      },
    });

    this.registerTool({
      key: "openai.chat_completions_create",
      name: "OpenAI Chat Completions",
      service: "openai",
      description: "Call OpenAI chat completions with the user's BYOK OpenAI key.",
      inputSchema: {
        type: "object",
        properties: {
          model: { type: "string" },
          messages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string", enum: ["system", "user", "assistant", "developer"] },
                content: { type: "string" },
              },
              required: ["role", "content"],
              additionalProperties: false,
            },
          },
          temperature: { type: "number" },
          baseUrl: { type: "string" },
        },
        required: ["messages"],
        additionalProperties: false,
      },
      execute: async (props, context) => {
        const openAiKey = await this.store.resolveServiceKey(context.userId, "openai");
        if (!openAiKey) {
          throw new Error("no OpenAI BYOK key configured for this user");
        }
        const baseUrl = readOptionalString(props.baseUrl) ?? DEFAULT_OPENAI_BASE_URL;
        const model = readOptionalString(props.model) ?? OPENAI_ROUTER_MODEL;
        const messages = Array.isArray(props.messages) ? props.messages : [];
        const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: typeof props.temperature === "number" ? props.temperature : 0.2,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(`OpenAI API ${response.status}: ${JSON.stringify(payload)}`);
        }
        return payload;
      },
    });

    this.registerTool({
      key: "slack.chat_postMessage",
      name: "Slack Chat Post Message",
      service: "slack",
      description: "Post a Slack message using the user's BYOK Slack bot token.",
      inputSchema: {
        type: "object",
        properties: {
          channel: { type: "string" },
          text: { type: "string" },
        },
        required: ["channel", "text"],
        additionalProperties: false,
      },
      execute: async (props, context) => {
        const token = await this.store.resolveServiceKey(context.userId, "slack");
        if (!token) {
          throw new Error("no Slack BYOK key configured for this user");
        }
        const channel = readString(props.channel, "channel");
        const text = readString(props.text, "text");
        const response = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ channel, text }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) {
          throw new Error(`Slack API error: ${JSON.stringify(payload)}`);
        }
        return payload;
      },
    });

    this.registerTool({
      key: "recipe.run",
      name: "Run Recipe",
      service: "recipes",
      description: "Execute a saved recipe (JSON/YAML workflow).",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string" },
          input: { type: "object" },
        },
        required: ["slug"],
        additionalProperties: true,
      },
      execute: async (props, context) => {
        const slug = readString(props.slug, "slug");
        return this.runRecipe(context.userId, slug, props.input);
      },
    });
  }

  private async runCliForUser(
    userId: string,
    args: string[],
    timeoutMs: number,
  ): Promise<CliRunResult> {
    const normalizedUserId = assertValidUserId(userId);
    await this.store.ensureUserDirectories(normalizedUserId);
    const userWorkspace = resolveHostedUserWorkspaceRoot(normalizedUserId);
    const userRuntimeState = resolveHostedUserRuntimeStateRoot(normalizedUserId);
    const startMs = Date.now();
    const command = [process.execPath, this.propaiEntryPath, ...args];

    return await new Promise<CliRunResult>((resolve) => {
      const child = spawn(process.execPath, [this.propaiEntryPath, ...args], {
        cwd: userWorkspace,
        env: {
          ...process.env,
          PROPAICLAW_MODE: "1",
          PROPAICLAW_HOME: userRuntimeState,
          PROPAICLAW_STATE_DIR: userRuntimeState,
          PROPAICLAW_CONFIG_PATH: path.join(userRuntimeState, "propaiclaw.json"),
          PROPAICLAW_PROFILE: normalizedUserId,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout = appendOutputChunk(stdout, chunk);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr = appendOutputChunk(stderr, chunk);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({
          command,
          exitCode: code,
          timedOut,
          durationMs: Date.now() - startMs,
          stdout,
          stderr,
        });
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        resolve({
          command,
          exitCode: null,
          timedOut,
          durationMs: Date.now() - startMs,
          stdout,
          stderr: [stderr, asErrorMessage(error)].filter(Boolean).join("\n"),
        });
      });
    });
  }

  async executeTool(
    userId: string,
    toolKey: string,
    props: Record<string, unknown> = {},
    context: Partial<HostedToolExecutionContext> = {},
  ): Promise<HostedToolExecutionResult> {
    await this.initialize();
    const startedAt = nowIso();
    const normalizedUserId = assertValidUserId(userId);
    const tool = this.tools.get(toolKey);
    if (!tool) {
      return {
        tool: toolKey,
        ok: false,
        startedAt,
        completedAt: nowIso(),
        error: `unknown tool: ${toolKey}`,
      };
    }
    try {
      const output = await tool.execute(props, {
        userId: normalizedUserId,
        task: context.task,
        prev: context.prev,
        input: context.input,
      });
      await this.store.appendLog({
        userId: normalizedUserId,
        type: "cli",
        message: `Tool executed: ${toolKey}`,
      });
      return {
        tool: toolKey,
        ok: true,
        startedAt,
        completedAt: nowIso(),
        output,
      };
    } catch (error) {
      const message = asErrorMessage(error);
      await this.store.appendLog({
        userId: normalizedUserId,
        type: "orchestrate_error",
        message: `Tool failed: ${toolKey}`,
        payload: { error: message },
      });
      return {
        tool: toolKey,
        ok: false,
        startedAt,
        completedAt: nowIso(),
        error: message,
      };
    }
  }

  private buildBuiltInAgents(): RuntimeAgent[] {
    return [
      {
        slug: "sync-agent",
        name: "Sync Agent",
        description: "Runs onboarding and sync tasks using PropAI CLI.",
        tools: ["propai.sync", "propai.status"],
        execute: async ({ task, runTool }) => {
          const lower = task.toLowerCase();
          const action = lower.includes("status") ? "propai.status" : "propai.sync";
          return runTool(action, {});
        },
      },
      {
        slug: "channel-agent",
        name: "Channel Agent",
        description: "Manages channel/runtime lifecycle: start, stop, status, connect whatsapp.",
        tools: ["propai.start", "propai.stop", "propai.status", "propai.connect_whatsapp"],
        execute: async ({ task, runTool }) => {
          const lower = task.toLowerCase();
          if (lower.includes("connect") || lower.includes("whatsapp")) {
            return runTool("propai.connect_whatsapp", {});
          }
          if (lower.includes("stop")) {
            return runTool("propai.stop", {});
          }
          if (lower.includes("start")) {
            return runTool("propai.start", {});
          }
          return runTool("propai.status", {});
        },
      },
      {
        slug: "lead-agent",
        name: "Lead Agent",
        description: "Produces lead-action planning using BYOK LLM context when available.",
        tools: ["openai.chat_completions_create"],
        execute: async ({ task, runTool }) => {
          try {
            const response = await runTool("openai.chat_completions_create", {
              model: OPENAI_ROUTER_MODEL,
              messages: [
                {
                  role: "system",
                  content:
                    "You are a real-estate operations planner. Return concise JSON with keys summary and next_actions.",
                },
                { role: "user", content: task },
              ],
              temperature: 0.2,
            });
            return response;
          } catch {
            return {
              summary: "BYOK OpenAI key missing; returned fallback lead guidance.",
              next_actions: [
                "Run propai sync",
                "Connect whatsapp channel",
                "Create a follow-up recipe under /api/recipes",
              ],
            };
          }
        },
      },
      {
        slug: "workflow-agent",
        name: "Workflow Agent",
        description: "Runs saved workflow recipes and trigger-oriented automations.",
        tools: ["recipe.run"],
        execute: async ({ task, runRecipe }) => {
          const match = /recipe[:\s]+([a-z0-9_-]+)/i.exec(task);
          if (!match?.[1]) {
            throw new Error('workflow-agent requires "recipe <slug>" in task text');
          }
          return runRecipe(match[1], { task });
        },
      },
      {
        slug: "ops-agent",
        name: "Ops Agent",
        description: "Executes explicit raw PropAI CLI actions.",
        tools: ["propai.raw"],
        execute: async ({ task, runTool }) => {
          const match = /raw[:\s]+(.+)$/i.exec(task);
          const raw = match?.[1]?.trim();
          if (!raw) {
            return { hint: 'Use "raw <args...>" in the task to run explicit CLI args.' };
          }
          const args = raw.split(/\s+/).filter(Boolean);
          return runTool("propai.raw", { args });
        },
      },
    ];
  }

  private async buildUserDefinedAgents(userId: string): Promise<RuntimeAgent[]> {
    const configs = await this.store.listUserDefinedAgents(userId);
    return configs.map((config) => ({
      slug: config.slug,
      name: config.name,
      description: config.description,
      tools: config.tools ?? [],
      execute: async ({ task, runTool }) => {
        if (config.defaultActionKey) {
          return runTool(config.defaultActionKey, { task });
        }
        if (config.cliArgs && config.cliArgs.length > 0) {
          return runTool("propai.raw", { args: config.cliArgs });
        }
        return {
          message: `User-defined agent "${config.slug}" has no executable action configured.`,
        };
      },
    }));
  }

  async listAgents(userId: string): Promise<HostedAgentDefinition[]> {
    const normalizedUserId = assertValidUserId(userId);
    const builtIns = this.buildBuiltInAgents();
    const userDefined = await this.buildUserDefinedAgents(normalizedUserId);
    return [...builtIns, ...userDefined].map((agent) => ({
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      tools: agent.tools,
    }));
  }

  private async resolveAgentMap(userId: string): Promise<Map<string, RuntimeAgent>> {
    const normalizedUserId = assertValidUserId(userId);
    const builtIns = this.buildBuiltInAgents();
    const userDefined = await this.buildUserDefinedAgents(normalizedUserId);
    return new Map<string, RuntimeAgent>([...builtIns, ...userDefined].map((agent) => [agent.slug, agent]));
  }

  async runRecipe(userId: string, slug: string, input?: unknown): Promise<{
    recipe: HostedRecipe;
    steps: Array<{
      index: number;
      agent: string;
      action: string;
      output: unknown;
    }>;
    output: unknown;
  }> {
    await this.initialize();
    const normalizedUserId = assertValidUserId(userId);
    const recipe = await this.store.getRecipe(normalizedUserId, slug);
    if (!recipe) {
      throw new Error(`recipe not found: ${slug}`);
    }

    const stepResults: Array<{ index: number; agent: string; action: string; output: unknown }> = [];
    let prev: unknown = input;
    for (let index = 0; index < recipe.steps.length; index += 1) {
      const step = recipe.steps[index];
      const actionProps = interpolateValue(step.action_props ?? {}, { prev, input }) as Record<
        string,
        unknown
      >;
      const toolResult = await this.executeTool(normalizedUserId, step.action_key, actionProps, {
        task: `recipe:${recipe.slug}`,
        prev,
        input,
      });
      if (!toolResult.ok) {
        throw new Error(`recipe step ${index + 1} failed: ${toolResult.error}`);
      }
      const rendered = renderByFormatGuide(toolResult.output, step.format_guide);
      stepResults.push({
        index,
        agent: step.agent_slug,
        action: step.action_key,
        output: rendered,
      });
      prev = rendered;
    }

    await this.store.appendLog({
      userId: normalizedUserId,
      type: "recipe",
      message: `Recipe executed: ${recipe.slug}`,
      payload: { steps: recipe.steps.length },
    });

    return {
      recipe,
      steps: stepResults,
      output: prev,
    };
  }

  private async routeWithByokLlm(
    userId: string,
    task: string,
    agentCatalog: HostedAgentDefinition[],
  ): Promise<{ mode: HostedOrchestrateMode; pipeline: string[]; router: "byok-llm" | "heuristic" }> {
    const openAiKey = await this.store.resolveServiceKey(userId, "openai");
    if (!openAiKey) {
      return routeTaskHeuristically(task);
    }

    const prompt = [
      "Route this task to agents.",
      `Task: ${task}`,
      'Return JSON only: {"mode":"sequential|parallel","agents":["slug"]}.',
      "Available agents:",
      ...agentCatalog.map((agent) => `- ${agent.slug}: ${agent.description}`),
    ].join("\n");

    try {
      const response = await fetch(`${DEFAULT_OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_ROUTER_MODEL,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "You are a routing engine. Return compact JSON only with mode and agents array.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return routeTaskHeuristically(task);
      }
      const content =
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { choices?: unknown }).choices) &&
        (payload as { choices: Array<{ message?: { content?: unknown } }> }).choices.length > 0
          ? (payload as { choices: Array<{ message?: { content?: unknown } }> }).choices[0]?.message
              ?.content
          : "";
      const parsed = parseFirstJsonObject(typeof content === "string" ? content : "");
      const modeRaw = parsed?.mode;
      const agentsRaw = parsed?.agents;
      const mode: HostedOrchestrateMode =
        modeRaw === "parallel" || modeRaw === "sequential" ? modeRaw : "sequential";
      const available = new Set(agentCatalog.map((agent) => agent.slug));
      const pipeline = Array.isArray(agentsRaw)
        ? agentsRaw
            .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
            .map((entry) => entry.trim())
            .filter((entry) => available.has(entry))
        : [];
      if (pipeline.length === 0) {
        return routeTaskHeuristically(task);
      }
      return { mode, pipeline, router: "byok-llm" };
    } catch {
      return routeTaskHeuristically(task);
    }
  }

  private async runAgent(
    agent: RuntimeAgent,
    params: { userId: string; task: string; input?: unknown },
  ): Promise<HostedAgentResult> {
    const startedAt = nowIso();
    try {
      const output = await agent.execute({
        userId: params.userId,
        task: params.task,
        input: params.input,
        runTool: async (toolKey, props = {}) => {
          const executed = await this.executeTool(params.userId, toolKey, props, {
            task: params.task,
            input: params.input,
          });
          if (!executed.ok) {
            throw new Error(executed.error ?? `tool failed: ${toolKey}`);
          }
          return executed.output;
        },
        runRecipe: async (recipeSlug, recipeInput) =>
          this.runRecipe(params.userId, recipeSlug, recipeInput),
      });
      return {
        agent: agent.slug,
        ok: true,
        startedAt,
        completedAt: nowIso(),
        output,
      };
    } catch (error) {
      return {
        agent: agent.slug,
        ok: false,
        startedAt,
        completedAt: nowIso(),
        error: asErrorMessage(error),
      };
    }
  }

  async orchestrate(params: {
    userId: string;
    task: string;
    mode?: HostedOrchestrateMode;
    pipeline?: string[];
  }): Promise<HostedOrchestrateResult> {
    await this.initialize();
    const userId = assertValidUserId(params.userId);
    const task = readString(params.task, "task");
    const startedAt = nowIso();
    const agentMap = await this.resolveAgentMap(userId);
    const catalog = [...agentMap.values()].map((agent) => ({
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      tools: agent.tools,
    }));

    let mode: HostedOrchestrateMode = "sequential";
    let pipeline: string[] = [];
    let router: HostedOrchestrateResult["router"] = "heuristic";

    if (Array.isArray(params.pipeline) && params.pipeline.length > 0) {
      const requested = params.pipeline.map((entry) => entry.trim()).filter(Boolean);
      pipeline = requested.filter((entry) => agentMap.has(entry));
      mode = params.mode === "parallel" ? "parallel" : "sequential";
      router = "explicit";
    } else {
      const routed = await this.routeWithByokLlm(userId, task, catalog);
      mode = params.mode ?? routed.mode;
      pipeline = routed.pipeline.filter((entry) => agentMap.has(entry));
      router = routed.router;
    }

    if (pipeline.length === 0) {
      throw new Error("no valid agents selected for orchestration");
    }

    const runOne = async (slug: string) => {
      const agent = agentMap.get(slug);
      if (!agent) {
        return {
          agent: slug,
          ok: false,
          startedAt: nowIso(),
          completedAt: nowIso(),
          error: `unknown agent: ${slug}`,
        } satisfies HostedAgentResult;
      }
      return this.runAgent(agent, { userId, task });
    };

    const results =
      mode === "parallel" ? await Promise.all(pipeline.map((slug) => runOne(slug))) : [];
    if (mode === "sequential") {
      for (const slug of pipeline) {
        results.push(await runOne(slug));
      }
    }

    const response: HostedOrchestrateResult = {
      userId,
      task,
      mode,
      pipeline,
      router,
      startedAt,
      completedAt: nowIso(),
      results,
    };

    const failed = results.filter((entry) => !entry.ok);
    await this.store.appendLog({
      userId,
      type: failed.length > 0 ? "orchestrate_error" : "orchestrate",
      message: `Orchestration finished (${pipeline.join(" -> ")})`,
      payload: {
        task,
        mode,
        failedAgents: failed.map((entry) => entry.agent),
      },
    });
    await this.fireEvent(userId, "orchestrate.completed", response).catch(() => undefined);

    return response;
  }

  async saveRecipe(params: {
    userId: string;
    slug: string;
    name: string;
    version?: number;
    steps: HostedRecipeStep[];
    format?: "json" | "yaml";
  }): Promise<HostedRecipe> {
    await this.initialize();
    const recipe = await this.store.saveRecipe(params);
    await this.store.appendLog({
      userId: recipe.userId,
      type: "recipe",
      message: `Recipe saved: ${recipe.slug}`,
      payload: { version: recipe.version },
    });
    return recipe;
  }

  async listRecipes(userId: string): Promise<HostedRecipe[]> {
    await this.initialize();
    return this.store.listRecipes(userId);
  }

  async deleteRecipe(userId: string, slug: string): Promise<boolean> {
    await this.initialize();
    const deleted = await this.store.deleteRecipe(userId, slug);
    if (deleted) {
      await this.store.appendLog({
        userId,
        type: "recipe",
        message: `Recipe deleted: ${slug}`,
      });
    }
    return deleted;
  }

  private triggerMapKey(trigger: Pick<HostedTrigger, "userId" | "id">): string {
    return `${trigger.userId}:${trigger.id}`;
  }

  private async executeTrigger(trigger: HostedTrigger, payload: unknown): Promise<void> {
    try {
      await this.runRecipe(trigger.userId, trigger.recipeSlug, payload);
      await this.store.appendLog({
        userId: trigger.userId,
        type: "trigger",
        message: `Trigger fired: ${trigger.name}`,
        payload: { triggerId: trigger.id, type: trigger.type },
      });
    } catch (error) {
      await this.store.appendLog({
        userId: trigger.userId,
        type: "trigger_error",
        message: `Trigger failed: ${trigger.name}`,
        payload: { triggerId: trigger.id, error: asErrorMessage(error) },
      });
    }
  }

  private clearScheduledJob(trigger: Pick<HostedTrigger, "userId" | "id">): void {
    const key = this.triggerMapKey(trigger);
    const existing = this.cronJobs.get(key);
    if (!existing) {
      return;
    }
    existing.stop();
    this.cronJobs.delete(key);
  }

  private scheduleCronTrigger(trigger: HostedTrigger): void {
    this.clearScheduledJob(trigger);
    if (trigger.type !== "cron" || !trigger.enabled || !trigger.schedule) {
      return;
    }
    const key = this.triggerMapKey(trigger);
    const job = new Cron(
      trigger.schedule,
      { timezone: trigger.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, catch: false },
      () => {
        void this.executeTrigger(trigger, { source: "cron", triggerId: trigger.id });
      },
    );
    this.cronJobs.set(key, job);
  }

  private async scheduleAllCronTriggers(): Promise<void> {
    const all = await this.store.listAllTriggers();
    for (const trigger of all) {
      this.scheduleCronTrigger(trigger);
    }
  }

  async listTriggers(userId: string): Promise<HostedTrigger[]> {
    await this.initialize();
    return this.store.listTriggers(userId);
  }

  async saveTrigger(params: {
    userId: string;
    id?: string;
    name: string;
    type: HostedTriggerType;
    recipeSlug: string;
    schedule?: string;
    timezone?: string;
    eventName?: string;
    enabled?: boolean;
  }): Promise<HostedTrigger> {
    await this.initialize();
    const userId = assertValidUserId(params.userId);
    const type = params.type;
    if (!["cron", "webhook", "event"].includes(type)) {
      throw new Error("trigger.type must be cron|webhook|event");
    }
    if (type === "cron" && !readOptionalString(params.schedule)) {
      throw new Error("cron trigger requires schedule");
    }
    if (type === "event" && !readOptionalString(params.eventName)) {
      throw new Error("event trigger requires eventName");
    }
    const trigger = await this.store.upsertTrigger({
      userId,
      trigger: {
        id: params.id ?? randomUUID(),
        name: readString(params.name, "name"),
        type,
        recipeSlug: readString(params.recipeSlug, "recipeSlug"),
        schedule: readOptionalString(params.schedule),
        timezone: readOptionalString(params.timezone),
        eventName: readOptionalString(params.eventName),
        webhookToken: type === "webhook" ? randomBytes(16).toString("hex") : undefined,
        enabled: params.enabled !== false,
      },
    });
    this.scheduleCronTrigger(trigger);
    return trigger;
  }

  async deleteTrigger(userId: string, triggerId: string): Promise<boolean> {
    await this.initialize();
    const normalizedUserId = assertValidUserId(userId);
    const deleted = await this.store.deleteTrigger(normalizedUserId, triggerId);
    this.clearScheduledJob({ userId: normalizedUserId, id: triggerId });
    return deleted;
  }

  async fireEvent(userId: string, eventName: string, payload: unknown): Promise<{ fired: number }> {
    await this.initialize();
    const normalizedUserId = assertValidUserId(userId);
    const normalizedEventName = readString(eventName, "eventName");
    const triggers = await this.store.listTriggers(normalizedUserId);
    const eventTriggers = triggers.filter(
      (entry) =>
        entry.type === "event" &&
        entry.enabled &&
        entry.eventName?.trim().toLowerCase() === normalizedEventName.toLowerCase(),
    );
    for (const trigger of eventTriggers) {
      await this.executeTrigger(trigger, {
        source: "event",
        eventName: normalizedEventName,
        payload,
      });
    }
    return { fired: eventTriggers.length };
  }

  async fireWebhook(webhookToken: string, payload: unknown): Promise<{ fired: number }> {
    await this.initialize();
    const token = readString(webhookToken, "webhookToken");
    const allTriggers = await this.store.listAllTriggers();
    const matches = allTriggers.filter(
      (entry) => entry.type === "webhook" && entry.enabled && entry.webhookToken === token,
    );
    for (const trigger of matches) {
      await this.executeTrigger(trigger, {
        source: "webhook",
        webhookToken: token,
        payload,
      });
    }
    return { fired: matches.length };
  }

  async runCliEndpoint(params: {
    userId: string;
    args: string[];
    timeoutMs?: number;
  }): Promise<CliRunResult> {
    await this.initialize();
    const userId = assertValidUserId(params.userId);
    const args = params.args.map((entry) => entry.trim()).filter(Boolean);
    if (args.length === 0) {
      throw new Error("args cannot be empty");
    }
    const timeoutMs = normalizeTimeout(params.timeoutMs, DEFAULT_CLI_TIMEOUT_MS);
    const result = await this.runCliForUser(userId, args, timeoutMs);
    await this.store.appendLog({
      userId,
      type: "cli",
      message: `CLI executed: propai ${args.join(" ")}`,
      payload: {
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        durationMs: result.durationMs,
      },
    });
    return result;
  }

  async listLogs(userId: string, limit?: number) {
    await this.initialize();
    const normalizedUserId = assertValidUserId(userId);
    const max = typeof limit === "number" && Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 100;
    return this.store.readLogs(normalizedUserId, max);
  }
}
