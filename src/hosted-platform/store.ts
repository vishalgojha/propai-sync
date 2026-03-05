import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { createAsyncLock, readJsonFile, writeJsonAtomic } from "../infra/json-files.js";
import {
  decryptSecret,
  encryptSecret,
  generateAccessKeyValue,
  hashAccessKey,
  resolveVaultMasterKey,
  verifyAccessKey,
} from "./crypto.js";
import {
  assertValidUserId,
  resolveHostedApiKeysPath,
  resolveHostedLogsPath,
  resolveHostedPlatformRoot,
  resolveHostedRecipesRoot,
  resolveHostedServiceKeysPath,
  resolveHostedTriggersPath,
  resolveHostedUserAgentsPath,
  resolveHostedUserRoot,
  resolveHostedUserRuntimeStateRoot,
  resolveHostedUsersRoot,
  resolveHostedUserWorkspaceRoot,
} from "./paths.js";
import type {
  ApiAccessKeyRecord,
  ApiKeyAuthResult,
  HostedLogEntry,
  HostedRecipe,
  HostedRecipeStep,
  HostedTrigger,
  ServiceKeyRecord,
  UserDefinedAgentConfig,
} from "./types.js";

const RECIPE_FILE_EXTENSIONS = [".yaml", ".yml", ".json"] as const;

function normalizeService(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  if (!normalized) {
    throw new Error("service cannot be empty");
  }
  return normalized;
}

function normalizeLabel(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function normalizeSlug(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  if (!normalized || normalized.length < 2 || normalized.length > 64) {
    throw new Error("slug must be 2-64 chars and only include [a-z0-9_-]");
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureRecipeSteps(value: unknown): HostedRecipeStep[] {
  if (!Array.isArray(value)) {
    throw new Error("recipe.steps must be an array");
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`recipe.steps[${index}] must be an object`);
    }
    const agentSlug = typeof entry.agent_slug === "string" ? entry.agent_slug.trim() : "";
    const actionKey = typeof entry.action_key === "string" ? entry.action_key.trim() : "";
    if (!agentSlug || !actionKey) {
      throw new Error(`recipe.steps[${index}] requires agent_slug and action_key`);
    }
    const actionProps =
      isRecord(entry.action_props) || entry.action_props === undefined
        ? (entry.action_props as Record<string, unknown> | undefined)
        : undefined;
    const formatGuide = typeof entry.format_guide === "string" ? entry.format_guide : undefined;
    return {
      agent_slug: agentSlug,
      action_key: actionKey,
      action_props: actionProps,
      format_guide: formatGuide,
    };
  });
}

async function readArrayFile<T>(filePath: string): Promise<T[]> {
  const parsed = await readJsonFile<unknown>(filePath);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function parseRecipeDocument(input: unknown, userId: string, slugFromPath: string): HostedRecipe | null {
  if (!isRecord(input)) {
    return null;
  }
  try {
    const slugRaw = typeof input.slug === "string" ? input.slug : slugFromPath;
    const slug = normalizeSlug(slugRaw);
    const name =
      typeof input.name === "string" && input.name.trim().length > 0
        ? input.name.trim()
        : slug.replace(/[-_]/g, " ");
    const steps = ensureRecipeSteps(input.steps);
    const createdAt =
      typeof input.createdAt === "string" && input.createdAt.trim().length > 0
        ? input.createdAt
        : new Date().toISOString();
    const updatedAt =
      typeof input.updatedAt === "string" && input.updatedAt.trim().length > 0
        ? input.updatedAt
        : createdAt;
    const version =
      typeof input.version === "number" && Number.isFinite(input.version)
        ? Math.max(1, Math.floor(input.version))
        : 1;
    return { userId, slug, name, steps, createdAt, updatedAt, version };
  } catch {
    return null;
  }
}

export class HostedPlatformStore {
  private readonly lock = createAsyncLock();
  private masterKey: Buffer | null = null;

  private async getMasterKey(): Promise<Buffer> {
    if (this.masterKey) {
      return this.masterKey;
    }
    this.masterKey = await resolveVaultMasterKey();
    return this.masterKey;
  }

  async ensureBaseDirectories(): Promise<void> {
    await fs.mkdir(resolveHostedPlatformRoot(), { recursive: true });
    await fs.mkdir(resolveHostedUsersRoot(), { recursive: true });
  }

  async ensureUserDirectories(userId: string): Promise<void> {
    const normalizedUserId = assertValidUserId(userId);
    await Promise.all([
      fs.mkdir(resolveHostedUserRoot(normalizedUserId), { recursive: true }),
      fs.mkdir(resolveHostedUserWorkspaceRoot(normalizedUserId), { recursive: true }),
      fs.mkdir(resolveHostedUserRuntimeStateRoot(normalizedUserId), { recursive: true }),
      fs.mkdir(resolveHostedRecipesRoot(normalizedUserId), { recursive: true }),
    ]);
  }

  private async readApiKeys(): Promise<ApiAccessKeyRecord[]> {
    return readArrayFile<ApiAccessKeyRecord>(resolveHostedApiKeysPath());
  }

  private async writeApiKeys(value: ApiAccessKeyRecord[]): Promise<void> {
    await writeJsonAtomic(resolveHostedApiKeysPath(), value);
  }

  async listApiAccessKeys(userId: string): Promise<ApiAccessKeyRecord[]> {
    const normalizedUserId = assertValidUserId(userId);
    const keys = await this.readApiKeys();
    return keys.filter((entry) => entry.userId === normalizedUserId);
  }

  async createApiAccessKey(params: {
    userId: string;
    label?: string;
  }): Promise<{ plainText: string; record: ApiAccessKeyRecord }> {
    const userId = assertValidUserId(params.userId);
    await this.ensureUserDirectories(userId);
    const plainText = generateAccessKeyValue();
    const hashed = hashAccessKey(plainText);
    const now = new Date().toISOString();
    const record: ApiAccessKeyRecord = {
      id: randomUUID(),
      userId,
      label: normalizeLabel(params.label, "default"),
      saltB64: hashed.saltB64,
      hashB64: hashed.hashB64,
      createdAt: now,
    };
    await this.lock(async () => {
      const keys = await this.readApiKeys();
      keys.push(record);
      await this.writeApiKeys(keys);
    });
    return { plainText, record };
  }

  async deleteApiAccessKey(userId: string, keyId: string): Promise<boolean> {
    const normalizedUserId = assertValidUserId(userId);
    return this.lock(async () => {
      const keys = await this.readApiKeys();
      const next = keys.filter((entry) => !(entry.userId === normalizedUserId && entry.id === keyId));
      if (next.length === keys.length) {
        return false;
      }
      await this.writeApiKeys(next);
      return true;
    });
  }

  async authenticateApiKey(value: string): Promise<ApiKeyAuthResult | null> {
    const candidates = await this.readApiKeys();
    for (const record of candidates) {
      if (!verifyAccessKey(value, record)) {
        continue;
      }
      await this.lock(async () => {
        const allKeys = await this.readApiKeys();
        const match = allKeys.find((entry) => entry.id === record.id);
        if (match) {
          match.lastUsedAt = new Date().toISOString();
          await this.writeApiKeys(allKeys);
        }
      });
      return {
        keyId: record.id,
        userId: record.userId,
      };
    }
    return null;
  }

  async listKnownUsers(): Promise<string[]> {
    const users = new Set<string>();
    const keyRecords = await this.readApiKeys();
    for (const record of keyRecords) {
      users.add(record.userId);
    }
    try {
      const dirs = await fs.readdir(resolveHostedUsersRoot(), { withFileTypes: true });
      for (const entry of dirs) {
        if (entry.isDirectory()) {
          try {
            users.add(assertValidUserId(entry.name));
          } catch {
            // Ignore unexpected directory names.
          }
        }
      }
    } catch {
      // Root may not exist yet.
    }
    return [...users];
  }

  async listServiceKeys(userId: string): Promise<ServiceKeyRecord[]> {
    const normalizedUserId = assertValidUserId(userId);
    return readArrayFile<ServiceKeyRecord>(resolveHostedServiceKeysPath(normalizedUserId));
  }

  async upsertServiceKey(params: {
    userId: string;
    service: string;
    label?: string;
    plainTextKey: string;
  }): Promise<ServiceKeyRecord> {
    const userId = assertValidUserId(params.userId);
    await this.ensureUserDirectories(userId);
    const service = normalizeService(params.service);
    const label = normalizeLabel(params.label, "default");
    const now = new Date().toISOString();
    const keyFile = resolveHostedServiceKeysPath(userId);
    const encrypted = encryptSecret(params.plainTextKey, await this.getMasterKey());

    return this.lock(async () => {
      const allKeys = await readArrayFile<ServiceKeyRecord>(keyFile);
      const existing = allKeys.find((entry) => entry.service === service && entry.label === label);
      if (existing) {
        existing.encrypted = encrypted;
        existing.updatedAt = now;
        await writeJsonAtomic(keyFile, allKeys);
        return existing;
      }

      const created: ServiceKeyRecord = {
        id: randomUUID(),
        userId,
        service,
        label,
        encrypted,
        createdAt: now,
        updatedAt: now,
      };
      allKeys.push(created);
      await writeJsonAtomic(keyFile, allKeys);
      return created;
    });
  }

  async deleteServiceKey(userId: string, keyId: string): Promise<boolean> {
    const normalizedUserId = assertValidUserId(userId);
    const keyFile = resolveHostedServiceKeysPath(normalizedUserId);
    return this.lock(async () => {
      const allKeys = await readArrayFile<ServiceKeyRecord>(keyFile);
      const next = allKeys.filter((entry) => entry.id !== keyId);
      if (next.length === allKeys.length) {
        return false;
      }
      await writeJsonAtomic(keyFile, next);
      return true;
    });
  }

  async resolveServiceKey(userId: string, service: string, label?: string): Promise<string | null> {
    const normalizedUserId = assertValidUserId(userId);
    const normalizedService = normalizeService(service);
    const normalizedLabel = normalizeLabel(label, "default");
    const keyFile = resolveHostedServiceKeysPath(normalizedUserId);
    const allKeys = await readArrayFile<ServiceKeyRecord>(keyFile);

    const exact = allKeys.find(
      (entry) => entry.service === normalizedService && entry.label === normalizedLabel,
    );
    const fallback = allKeys.find((entry) => entry.service === normalizedService);
    const selected = exact ?? fallback;
    if (!selected) {
      return null;
    }

    const plain = decryptSecret(selected.encrypted, await this.getMasterKey());
    await this.lock(async () => {
      const keys = await readArrayFile<ServiceKeyRecord>(keyFile);
      const current = keys.find((entry) => entry.id === selected.id);
      if (current) {
        current.lastUsedAt = new Date().toISOString();
        await writeJsonAtomic(keyFile, keys);
      }
    });
    return plain;
  }

  private resolveRecipePath(userId: string, slug: string, ext: (typeof RECIPE_FILE_EXTENSIONS)[number]) {
    return path.join(resolveHostedRecipesRoot(userId), `${slug}${ext}`);
  }

  private async loadRecipeFromFile(userId: string, filePath: string): Promise<HostedRecipe | null> {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const ext = path.extname(filePath).toLowerCase();
      const parsed: unknown = ext === ".json" ? JSON.parse(raw) : parseYaml(raw);
      return parseRecipeDocument(parsed, userId, path.basename(filePath, ext));
    } catch {
      return null;
    }
  }

  async listRecipes(userId: string): Promise<HostedRecipe[]> {
    const normalizedUserId = assertValidUserId(userId);
    const root = resolveHostedRecipesRoot(normalizedUserId);
    await fs.mkdir(root, { recursive: true });
    const entries = await fs.readdir(root, { withFileTypes: true });
    const recipes: HostedRecipe[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!RECIPE_FILE_EXTENSIONS.includes(ext as (typeof RECIPE_FILE_EXTENSIONS)[number])) {
        continue;
      }
      const loaded = await this.loadRecipeFromFile(normalizedUserId, path.join(root, entry.name));
      if (loaded) {
        recipes.push(loaded);
      }
    }
    recipes.sort((a, b) => a.slug.localeCompare(b.slug));
    return recipes;
  }

  async getRecipe(userId: string, slug: string): Promise<HostedRecipe | null> {
    const normalizedUserId = assertValidUserId(userId);
    const normalizedSlug = normalizeSlug(slug);
    for (const ext of RECIPE_FILE_EXTENSIONS) {
      const filePath = this.resolveRecipePath(normalizedUserId, normalizedSlug, ext);
      const loaded = await this.loadRecipeFromFile(normalizedUserId, filePath);
      if (loaded) {
        return loaded;
      }
    }
    return null;
  }

  async saveRecipe(params: {
    userId: string;
    slug: string;
    name: string;
    version?: number;
    steps: HostedRecipeStep[];
    format?: "json" | "yaml";
  }): Promise<HostedRecipe> {
    const userId = assertValidUserId(params.userId);
    const slug = normalizeSlug(params.slug);
    const name = params.name.trim() || slug;
    const steps = ensureRecipeSteps(params.steps);
    const now = new Date().toISOString();
    const existing = await this.getRecipe(userId, slug);
    const recipe: HostedRecipe = {
      userId,
      slug,
      name,
      steps,
      version: Math.max(1, Math.floor(params.version ?? existing?.version ?? 1)),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.ensureUserDirectories(userId);
    const extension = params.format === "json" ? ".json" : ".yaml";
    const targetPath = this.resolveRecipePath(userId, slug, extension);
    const payload =
      extension === ".json" ? JSON.stringify(recipe, null, 2) : stringifyYaml(recipe, { indent: 2 });
    await fs.writeFile(targetPath, `${payload}\n`, "utf8");
    for (const ext of RECIPE_FILE_EXTENSIONS) {
      if (ext === extension) {
        continue;
      }
      await fs.rm(this.resolveRecipePath(userId, slug, ext), { force: true });
    }
    return recipe;
  }

  async deleteRecipe(userId: string, slug: string): Promise<boolean> {
    const normalizedUserId = assertValidUserId(userId);
    const normalizedSlug = normalizeSlug(slug);
    let deleted = false;
    for (const ext of RECIPE_FILE_EXTENSIONS) {
      const recipePath = this.resolveRecipePath(normalizedUserId, normalizedSlug, ext);
      try {
        await fs.rm(recipePath);
        deleted = true;
      } catch {
        // Ignore missing files.
      }
    }
    return deleted;
  }

  async listTriggers(userId: string): Promise<HostedTrigger[]> {
    const normalizedUserId = assertValidUserId(userId);
    const filePath = resolveHostedTriggersPath(normalizedUserId);
    const triggers = await readArrayFile<HostedTrigger>(filePath);
    return triggers.filter((entry) => entry.userId === normalizedUserId);
  }

  async listAllTriggers(): Promise<HostedTrigger[]> {
    const users = await this.listKnownUsers();
    const all: HostedTrigger[] = [];
    for (const userId of users) {
      const triggers = await this.listTriggers(userId);
      all.push(...triggers);
    }
    return all;
  }

  async upsertTrigger(params: {
    userId: string;
    trigger: Omit<HostedTrigger, "userId" | "createdAt" | "updatedAt">;
  }): Promise<HostedTrigger> {
    const userId = assertValidUserId(params.userId);
    await this.ensureUserDirectories(userId);
    const now = new Date().toISOString();
    const filePath = resolveHostedTriggersPath(userId);
    return this.lock(async () => {
      const triggers = await readArrayFile<HostedTrigger>(filePath);
      const existing = triggers.find((entry) => entry.id === params.trigger.id);
      if (existing) {
        const updated: HostedTrigger = {
          ...existing,
          ...params.trigger,
          userId,
          updatedAt: now,
        };
        const next = triggers.map((entry) => (entry.id === updated.id ? updated : entry));
        await writeJsonAtomic(filePath, next);
        return updated;
      }
      const created: HostedTrigger = {
        ...params.trigger,
        userId,
        createdAt: now,
        updatedAt: now,
      };
      triggers.push(created);
      await writeJsonAtomic(filePath, triggers);
      return created;
    });
  }

  async deleteTrigger(userId: string, triggerId: string): Promise<boolean> {
    const normalizedUserId = assertValidUserId(userId);
    const filePath = resolveHostedTriggersPath(normalizedUserId);
    return this.lock(async () => {
      const triggers = await readArrayFile<HostedTrigger>(filePath);
      const next = triggers.filter((entry) => entry.id !== triggerId);
      if (next.length === triggers.length) {
        return false;
      }
      await writeJsonAtomic(filePath, next);
      return true;
    });
  }

  async appendLog(entry: Omit<HostedLogEntry, "id" | "ts"> & { ts?: string }): Promise<HostedLogEntry> {
    const userId = assertValidUserId(entry.userId);
    await this.ensureUserDirectories(userId);
    const created: HostedLogEntry = {
      ...entry,
      id: randomUUID(),
      ts: entry.ts ?? new Date().toISOString(),
    };
    const filePath = resolveHostedLogsPath(userId);
    await fs.appendFile(filePath, `${JSON.stringify(created)}\n`, { encoding: "utf8" });
    return created;
  }

  async readLogs(userId: string, limit = 100): Promise<HostedLogEntry[]> {
    const normalizedUserId = assertValidUserId(userId);
    const filePath = resolveHostedLogsPath(normalizedUserId);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as HostedLogEntry;
          } catch {
            return null;
          }
        })
        .filter((line): line is HostedLogEntry => line !== null);
      return parsed.slice(Math.max(0, parsed.length - Math.max(1, limit))).toReversed();
    } catch {
      return [];
    }
  }

  async listUserDefinedAgents(userId: string): Promise<UserDefinedAgentConfig[]> {
    const normalizedUserId = assertValidUserId(userId);
    const filePath = resolveHostedUserAgentsPath(normalizedUserId);
    const parsed = await readArrayFile<unknown>(filePath);
    const agents: UserDefinedAgentConfig[] = [];
    for (const item of parsed) {
      if (!isRecord(item)) {
        continue;
      }
      const slug = typeof item.slug === "string" ? item.slug.trim() : "";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const description = typeof item.description === "string" ? item.description.trim() : "";
      if (!slug || !name || !description) {
        continue;
      }
      const tools =
        Array.isArray(item.tools) && item.tools.every((entry) => typeof entry === "string")
          ? (item.tools as string[])
          : undefined;
      const defaultActionKey =
        typeof item.defaultActionKey === "string" ? item.defaultActionKey.trim() : undefined;
      const cliArgs =
        Array.isArray(item.cliArgs) && item.cliArgs.every((entry) => typeof entry === "string")
          ? (item.cliArgs as string[])
          : undefined;
      agents.push({
        slug: normalizeSlug(slug),
        name,
        description,
        tools,
        defaultActionKey,
        cliArgs,
      });
    }
    return agents;
  }
}
