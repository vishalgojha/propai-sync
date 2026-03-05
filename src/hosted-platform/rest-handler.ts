import type { IncomingMessage, ServerResponse } from "node:http";
import { parse as parseYaml } from "yaml";
import { getHeader } from "../gateway/http-utils.js";
import {
  readJsonBodyOrError,
  sendInvalidRequest,
  sendJson,
  sendMethodNotAllowed,
  sendUnauthorized,
} from "../gateway/http-common.js";
import { HostedPlatformRuntime } from "./runtime.js";
import type { HostedRecipeStep } from "./types.js";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const ADMIN_BOOTSTRAP_ENV_KEY = "PROPAI_HOSTED_ADMIN_TOKEN";

const runtime = new HostedPlatformRuntime();

function enableCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key, X-Admin-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Cache-Control", "no-store");
}

type AuthenticatedRequest = {
  userId: string;
  keyId: string;
};

async function authenticateApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<AuthenticatedRequest | null> {
  const apiKey = getHeader(req, "x-api-key")?.trim();
  if (!apiKey) {
    sendUnauthorized(res);
    return null;
  }
  const auth = await runtime.authenticateApiKey(apiKey);
  if (!auth) {
    sendUnauthorized(res);
    return null;
  }
  return auth;
}

function bodyUserIdOrFallback(body: Record<string, unknown>, fallbackUserId: string): string {
  const raw = body.userId;
  if (typeof raw !== "string" || !raw.trim()) {
    return fallbackUserId;
  }
  return raw.trim();
}

function requireSameUser(
  requestedUserId: string,
  auth: AuthenticatedRequest,
  res: ServerResponse,
): boolean {
  if (requestedUserId !== auth.userId) {
    sendJson(res, 403, {
      error: { type: "forbidden", message: "userId does not match the API key owner" },
    });
    return false;
  }
  return true;
}

function parsePathWithPrefix(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) {
    return null;
  }
  const value = pathname.slice(prefix.length).trim();
  if (!value) {
    return null;
  }
  return decodeURIComponent(value);
}

function parseRecipeInputFromBody(body: Record<string, unknown>): {
  slug?: string;
  name?: string;
  version?: number;
  steps?: unknown;
  format?: "json" | "yaml";
} {
  if (typeof body.content === "string" && body.content.trim()) {
    const format = body.format === "json" ? "json" : body.format === "yaml" ? "yaml" : undefined;
    const parsed =
      format === "json"
        ? (JSON.parse(body.content) as Record<string, unknown>)
        : format === "yaml"
          ? (parseYaml(body.content) as Record<string, unknown>)
          : (() => {
              try {
                return JSON.parse(body.content) as Record<string, unknown>;
              } catch {
                return parseYaml(body.content) as Record<string, unknown>;
              }
            })();
    return {
      slug: typeof parsed.slug === "string" ? parsed.slug : undefined,
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      version: typeof parsed.version === "number" ? parsed.version : undefined,
      steps: parsed.steps,
      format,
    };
  }
  return {
    slug: typeof body.slug === "string" ? body.slug : undefined,
    name: typeof body.name === "string" ? body.name : undefined,
    version: typeof body.version === "number" ? body.version : undefined,
    steps: body.steps,
    format: body.format === "json" ? "json" : body.format === "yaml" ? "yaml" : undefined,
  };
}

async function handleBootstrap(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, "POST");
    return true;
  }
  const bodyUnknown = await readJsonBodyOrError(req, res, MAX_BODY_BYTES);
  if (bodyUnknown === undefined) {
    return true;
  }
  const body = (bodyUnknown ?? {}) as Record<string, unknown>;
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    sendInvalidRequest(res, "bootstrap requires body.userId");
    return true;
  }
  const expectedToken = process.env[ADMIN_BOOTSTRAP_ENV_KEY]?.trim();
  if (expectedToken) {
    const suppliedToken =
      getHeader(req, "x-admin-token")?.trim() ||
      (typeof body.adminToken === "string" ? body.adminToken.trim() : "");
    if (!suppliedToken || suppliedToken !== expectedToken) {
      sendJson(res, 403, {
        error: { type: "forbidden", message: "invalid admin bootstrap token" },
      });
      return true;
    }
  }

  try {
    const created = await runtime.bootstrapApiAccess({
      userId,
      label: typeof body.label === "string" ? body.label : undefined,
    });
    sendJson(res, 201, {
      userId: created.record.userId,
      keyId: created.record.id,
      label: created.record.label,
      createdAt: created.record.createdAt,
      apiKey: created.apiKey,
    });
  } catch (error) {
    sendJson(res, 400, {
      error: { type: "invalid_request", message: error instanceof Error ? error.message : String(error) },
    });
  }
  return true;
}

export async function handleHostedPlatformHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!(url.pathname === "/api" || url.pathname.startsWith("/api/"))) {
    return false;
  }
  enableCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (url.pathname === "/api/health") {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }
    sendJson(res, 200, { ok: true, service: "hosted-platform" });
    return true;
  }

  if (url.pathname === "/api/auth/bootstrap") {
    return handleBootstrap(req, res);
  }

  const webhookToken = parsePathWithPrefix(url.pathname, "/api/triggers/webhook/");
  if (webhookToken) {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const bodyUnknown = await readJsonBodyOrError(req, res, MAX_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const fired = await runtime.fireWebhook(webhookToken, bodyUnknown ?? {});
    sendJson(res, 200, fired);
    return true;
  }

  const auth = await authenticateApiRequest(req, res);
  if (!auth) {
    return true;
  }

  if (url.pathname === "/api/users/me") {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }
    const keys = await runtime.listKeySummary(auth.userId);
    sendJson(res, 200, {
      userId: auth.userId,
      keyId: auth.keyId,
      apiKeys: keys.apiKeys,
      serviceKeys: keys.serviceKeys,
    });
    return true;
  }

  if (url.pathname === "/api/keys") {
    if (req.method === "GET") {
      const keys = await runtime.listKeySummary(auth.userId);
      sendJson(res, 200, keys);
      return true;
    }
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "GET, POST");
      return true;
    }
    const bodyUnknown = await readJsonBodyOrError(req, res, MAX_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const body = (bodyUnknown ?? {}) as Record<string, unknown>;
    const userId = bodyUserIdOrFallback(body, auth.userId);
    if (!requireSameUser(userId, auth, res)) {
      return true;
    }
    const service = typeof body.service === "string" ? body.service : "";
    const plainTextKey =
      typeof body.key === "string"
        ? body.key
        : typeof body.apiKey === "string"
          ? body.apiKey
          : "";
    if (!service || !plainTextKey) {
      sendInvalidRequest(res, "POST /api/keys requires body.service and body.key");
      return true;
    }
    try {
      const saved = await runtime.saveServiceKey({
        userId,
        service,
        label: typeof body.label === "string" ? body.label : undefined,
        plainTextKey,
      });
      sendJson(res, 201, saved);
    } catch (error) {
      sendJson(res, 400, {
        error: { type: "invalid_request", message: error instanceof Error ? error.message : String(error) },
      });
    }
    return true;
  }

  const keyId = parsePathWithPrefix(url.pathname, "/api/keys/");
  if (keyId) {
    if (req.method !== "DELETE") {
      sendMethodNotAllowed(res, "DELETE");
      return true;
    }
    const deleted = await runtime.deleteKey(auth.userId, keyId);
    sendJson(res, 200, deleted);
    return true;
  }

  if (url.pathname === "/api/agents") {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }
    const agents = await runtime.listAgents(auth.userId);
    sendJson(res, 200, { agents });
    return true;
  }

  if (url.pathname === "/api/tools") {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }
    sendJson(res, 200, { tools: runtime.listTools() });
    return true;
  }

  if (url.pathname === "/api/orchestrate") {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const bodyUnknown = await readJsonBodyOrError(req, res, MAX_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const body = (bodyUnknown ?? {}) as Record<string, unknown>;
    const userId = bodyUserIdOrFallback(body, auth.userId);
    if (!requireSameUser(userId, auth, res)) {
      return true;
    }
    if (typeof body.task !== "string" || !body.task.trim()) {
      sendInvalidRequest(res, "orchestrate requires non-empty body.task");
      return true;
    }
    try {
      const result = await runtime.orchestrate({
        userId,
        task: body.task,
        mode: body.mode === "parallel" ? "parallel" : body.mode === "sequential" ? "sequential" : undefined,
        pipeline:
          Array.isArray(body.pipeline) && body.pipeline.every((entry) => typeof entry === "string")
            ? (body.pipeline as string[])
            : undefined,
      });
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, {
        error: { type: "invalid_request", message: error instanceof Error ? error.message : String(error) },
      });
    }
    return true;
  }

  if (url.pathname === "/api/recipes") {
    if (req.method === "GET") {
      const recipes = await runtime.listRecipes(auth.userId);
      sendJson(res, 200, { recipes });
      return true;
    }
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "GET, POST");
      return true;
    }
    const bodyUnknown = await readJsonBodyOrError(req, res, MAX_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const body = (bodyUnknown ?? {}) as Record<string, unknown>;
    const requestedUserId = bodyUserIdOrFallback(body, auth.userId);
    if (!requireSameUser(requestedUserId, auth, res)) {
      return true;
    }
    try {
      const parsedRecipe = parseRecipeInputFromBody(body);
      if (!parsedRecipe.slug || !parsedRecipe.name || !Array.isArray(parsedRecipe.steps)) {
        sendInvalidRequest(res, "recipe requires slug, name, and steps[]");
        return true;
      }
      const saved = await runtime.saveRecipe({
        userId: requestedUserId,
        slug: parsedRecipe.slug,
        name: parsedRecipe.name,
        version: parsedRecipe.version,
        steps: parsedRecipe.steps as HostedRecipeStep[],
        format: parsedRecipe.format,
      });
      sendJson(res, 201, saved);
    } catch (error) {
      sendJson(res, 400, {
        error: { type: "invalid_request", message: error instanceof Error ? error.message : String(error) },
      });
    }
    return true;
  }

  const recipeRunSlug = parsePathWithPrefix(url.pathname, "/api/recipes/");
  if (recipeRunSlug && url.pathname.endsWith("/run")) {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const slug = recipeRunSlug.slice(0, -"/run".length);
    const bodyUnknown = await readJsonBodyOrError(req, res, MAX_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const body = (bodyUnknown ?? {}) as Record<string, unknown>;
    const userId = bodyUserIdOrFallback(body, auth.userId);
    if (!requireSameUser(userId, auth, res)) {
      return true;
    }
    try {
      const result = await runtime.runRecipe(userId, slug, body.input);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, {
        error: { type: "invalid_request", message: error instanceof Error ? error.message : String(error) },
      });
    }
    return true;
  }

  const recipeSlug = parsePathWithPrefix(url.pathname, "/api/recipes/");
  if (recipeSlug) {
    if (req.method !== "DELETE") {
      sendMethodNotAllowed(res, "DELETE");
      return true;
    }
    const deleted = await runtime.deleteRecipe(auth.userId, recipeSlug);
    sendJson(res, 200, { deleted });
    return true;
  }

  if (url.pathname === "/api/triggers") {
    if (req.method === "GET") {
      const triggers = await runtime.listTriggers(auth.userId);
      sendJson(res, 200, { triggers });
      return true;
    }
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "GET, POST");
      return true;
    }
    const bodyUnknown = await readJsonBodyOrError(req, res, MAX_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const body = (bodyUnknown ?? {}) as Record<string, unknown>;
    const userId = bodyUserIdOrFallback(body, auth.userId);
    if (!requireSameUser(userId, auth, res)) {
      return true;
    }
    try {
      const trigger = await runtime.saveTrigger({
        userId,
        id: typeof body.id === "string" ? body.id : undefined,
        name: typeof body.name === "string" ? body.name : "",
        type: body.type as "cron" | "webhook" | "event",
        recipeSlug: typeof body.recipeSlug === "string" ? body.recipeSlug : "",
        schedule: typeof body.schedule === "string" ? body.schedule : undefined,
        timezone: typeof body.timezone === "string" ? body.timezone : undefined,
        eventName: typeof body.eventName === "string" ? body.eventName : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      });
      sendJson(res, 201, trigger);
    } catch (error) {
      sendJson(res, 400, {
        error: { type: "invalid_request", message: error instanceof Error ? error.message : String(error) },
      });
    }
    return true;
  }

  const triggerId = parsePathWithPrefix(url.pathname, "/api/triggers/");
  if (triggerId && !url.pathname.includes("/events/")) {
    if (req.method !== "DELETE") {
      sendMethodNotAllowed(res, "DELETE");
      return true;
    }
    const deleted = await runtime.deleteTrigger(auth.userId, triggerId);
    sendJson(res, 200, { deleted });
    return true;
  }

  const eventName = parsePathWithPrefix(url.pathname, "/api/triggers/events/");
  if (eventName) {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const bodyUnknown = await readJsonBodyOrError(req, res, MAX_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const body = (bodyUnknown ?? {}) as Record<string, unknown>;
    const userId = bodyUserIdOrFallback(body, auth.userId);
    if (!requireSameUser(userId, auth, res)) {
      return true;
    }
    const result = await runtime.fireEvent(userId, eventName, body.payload ?? {});
    sendJson(res, 200, result);
    return true;
  }

  if (url.pathname === "/api/cli/run") {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const bodyUnknown = await readJsonBodyOrError(req, res, MAX_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const body = (bodyUnknown ?? {}) as Record<string, unknown>;
    const userId = bodyUserIdOrFallback(body, auth.userId);
    if (!requireSameUser(userId, auth, res)) {
      return true;
    }
    try {
      const result = await runtime.runCliEndpoint({
        userId,
        args:
          Array.isArray(body.args) && body.args.every((entry) => typeof entry === "string")
            ? (body.args as string[])
            : [],
        timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
      });
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, {
        error: { type: "invalid_request", message: error instanceof Error ? error.message : String(error) },
      });
    }
    return true;
  }

  const cliAction = parsePathWithPrefix(url.pathname, "/api/cli/");
  if (cliAction && cliAction !== "run") {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const argsByAction: Record<string, string[]> = {
      sync: ["sync"],
      start: ["start"],
      stop: ["stop"],
      status: ["status"],
      "connect-whatsapp": ["connect", "whatsapp"],
    };
    const selectedArgs = argsByAction[cliAction];
    if (!selectedArgs) {
      sendJson(res, 404, { error: { type: "not_found", message: `Unknown CLI action: ${cliAction}` } });
      return true;
    }
    const bodyUnknown = await readJsonBodyOrError(req, res, MAX_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const body = (bodyUnknown ?? {}) as Record<string, unknown>;
    const userId = bodyUserIdOrFallback(body, auth.userId);
    if (!requireSameUser(userId, auth, res)) {
      return true;
    }
    const result = await runtime.runCliEndpoint({
      userId,
      args: selectedArgs,
      timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
    });
    sendJson(res, 200, result);
    return true;
  }

  if (url.pathname === "/api/logs") {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }
    const limit = Number(url.searchParams.get("limit") ?? "100");
    const logs = await runtime.listLogs(auth.userId, Number.isFinite(limit) ? limit : undefined);
    sendJson(res, 200, { logs });
    return true;
  }

  sendJson(res, 404, { error: { type: "not_found", message: "Unknown hosted API route" } });
  return true;
}
