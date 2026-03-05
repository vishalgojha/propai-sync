import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  type ApiAccessKeyRecord,
  type EncryptedSecretPayload,
  type ServiceKeyRecord,
} from "./types.js";
import { resolveHostedVaultMasterKeyPath } from "./paths.js";

const CIPHER_ALG = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const MASTER_KEY_BYTES = 32;

function normalizeSecretInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("secret cannot be empty");
  }
  return trimmed;
}

function parseMasterKeyFromEnv(raw: string): Buffer {
  const normalized = normalizeSecretInput(raw);
  try {
    const maybeB64 = Buffer.from(normalized, "base64");
    if (maybeB64.length === MASTER_KEY_BYTES) {
      return maybeB64;
    }
  } catch {
    // Fall through to deterministic hash.
  }
  return createHash("sha256").update(normalized).digest();
}

async function readPersistedMasterKey(filePath: string): Promise<Buffer | null> {
  try {
    const raw = (await fs.readFile(filePath, "utf8")).trim();
    if (!raw) {
      return null;
    }
    const parsed = Buffer.from(raw, "base64");
    if (parsed.length !== MASTER_KEY_BYTES) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writePersistedMasterKey(filePath: string, key: Buffer): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, key.toString("base64"), { encoding: "utf8", mode: 0o600 });
}

export async function resolveVaultMasterKey(env: NodeJS.ProcessEnv = process.env): Promise<Buffer> {
  const envValue = env.PROPAI_VAULT_MASTER_KEY ?? env.PROPAICLAW_VAULT_MASTER_KEY;
  if (typeof envValue === "string" && envValue.trim()) {
    return parseMasterKeyFromEnv(envValue);
  }

  const path = resolveHostedVaultMasterKeyPath(env);
  const existing = await readPersistedMasterKey(path);
  if (existing) {
    return existing;
  }

  const generated = randomBytes(MASTER_KEY_BYTES);
  await writePersistedMasterKey(path, generated);
  return generated;
}

export function encryptSecret(plainText: string, masterKey: Buffer): EncryptedSecretPayload {
  const normalized = normalizeSecretInput(plainText);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER_ALG, masterKey, iv, { authTagLength: AUTH_TAG_BYTES });
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: CIPHER_ALG,
    ivB64: iv.toString("base64"),
    dataB64: encrypted.toString("base64"),
    tagB64: tag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedSecretPayload, masterKey: Buffer): string {
  if (payload.alg !== CIPHER_ALG) {
    throw new Error(`unsupported encryption algorithm: ${payload.alg}`);
  }
  const iv = Buffer.from(payload.ivB64, "base64");
  const tag = Buffer.from(payload.tagB64, "base64");
  const data = Buffer.from(payload.dataB64, "base64");
  const decipher = createDecipheriv(CIPHER_ALG, masterKey, iv, { authTagLength: AUTH_TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function generateAccessKeyValue(): string {
  return `pk_propai_${randomBytes(24).toString("base64url")}`;
}

export function hashAccessKey(value: string): { saltB64: string; hashB64: string } {
  const normalized = normalizeSecretInput(value);
  const salt = randomBytes(16);
  const hash = scryptSync(normalized, salt, 32);
  return {
    saltB64: salt.toString("base64"),
    hashB64: hash.toString("base64"),
  };
}

export function verifyAccessKey(value: string, record: ApiAccessKeyRecord): boolean {
  const normalized = normalizeSecretInput(value);
  const salt = Buffer.from(record.saltB64, "base64");
  const expected = Buffer.from(record.hashB64, "base64");
  const actual = scryptSync(normalized, salt, expected.length);
  if (actual.length !== expected.length) {
    return false;
  }
  let matches = 1;
  for (let i = 0; i < expected.length; i += 1) {
    matches &= actual[i] === expected[i] ? 1 : 0;
  }
  return matches === 1;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, "");
}

export function maskSecretValue(value: string): string {
  const compact = collapseWhitespace(value);
  if (compact.length <= 8) {
    return `${compact.slice(0, 2)}***${compact.slice(-2)}`;
  }
  return `${compact.slice(0, 4)}***${compact.slice(-4)}`;
}

export function maskServiceKey(record: ServiceKeyRecord): Pick<
  ServiceKeyRecord,
  "id" | "userId" | "service" | "label" | "createdAt" | "updatedAt" | "lastUsedAt"
> {
  const { id, userId, service, label, createdAt, updatedAt, lastUsedAt } = record;
  return { id, userId, service, label, createdAt, updatedAt, lastUsedAt };
}
