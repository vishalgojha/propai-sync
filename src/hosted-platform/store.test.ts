import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HostedPlatformStore } from "./store.js";

const ORIGINAL_ENV = { ...process.env };

async function createTempStateDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "hosted-platform-store-"));
}

function restoreProcessEnv(snapshot: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
}

describe("HostedPlatformStore", () => {
  let tempStateDir = "";

  beforeEach(async () => {
    tempStateDir = await createTempStateDir();
    process.env.PROPAICLAW_STATE_DIR = tempStateDir;
    process.env.PROPAICLAW_MODE = "1";
    delete process.env.PROPAI_VAULT_MASTER_KEY;
    delete process.env.PROPAICLAW_VAULT_MASTER_KEY;
  });

  afterEach(async () => {
    restoreProcessEnv(ORIGINAL_ENV);
    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
    }
  });

  it("rotates service keys in-place and resolves only the latest secret", async () => {
    const store = new HostedPlatformStore();
    const userId = "tenant-alpha";

    const first = await store.upsertServiceKey({
      userId,
      service: "openai",
      label: "default",
      plainTextKey: "sk-first-secret",
    });

    expect(await store.resolveServiceKey(userId, "openai", "default")).toBe("sk-first-secret");

    const second = await store.upsertServiceKey({
      userId,
      service: "openai",
      label: "default",
      plainTextKey: "sk-rotated-secret",
    });

    expect(second.id).toBe(first.id);
    expect(await store.resolveServiceKey(userId, "openai", "default")).toBe("sk-rotated-secret");

    const keys = await store.listServiceKeys(userId);
    expect(keys).toHaveLength(1);
    expect(keys[0]?.id).toBe(first.id);
  });

  it("supports API key recovery by keeping non-revoked keys valid", async () => {
    const store = new HostedPlatformStore();
    const userId = "tenant-bravo";

    const keyA = await store.createApiAccessKey({ userId, label: "mobile" });
    const keyB = await store.createApiAccessKey({ userId, label: "dashboard" });

    expect(await store.authenticateApiKey(keyA.plainText)).toMatchObject({ userId });
    expect(await store.authenticateApiKey(keyB.plainText)).toMatchObject({ userId });

    expect(await store.deleteApiAccessKey(userId, keyA.record.id)).toBe(true);
    expect(await store.authenticateApiKey(keyA.plainText)).toBeNull();

    const recovered = await store.authenticateApiKey(keyB.plainText);
    expect(recovered).toMatchObject({ userId, keyId: keyB.record.id });
  });

  it("enforces tenant isolation for user-scoped key resolution", async () => {
    const store = new HostedPlatformStore();

    await store.upsertServiceKey({
      userId: "tenant-one",
      service: "openai",
      plainTextKey: "sk-tenant-one",
    });
    await store.upsertServiceKey({
      userId: "tenant-two",
      service: "openai",
      plainTextKey: "sk-tenant-two",
    });

    expect(await store.resolveServiceKey("tenant-one", "openai")).toBe("sk-tenant-one");
    expect(await store.resolveServiceKey("tenant-two", "openai")).toBe("sk-tenant-two");
    expect(await store.resolveServiceKey("tenant-three", "openai")).toBeNull();
  });
});
