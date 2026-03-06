import fs from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveHostedSecurityAuditLogPath } from "./paths.js";

const ORIGINAL_ENV = { ...process.env };

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

async function createTempStateDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "hosted-platform-http-"));
}

async function startHostedApiServer(): Promise<{ server: Server; port: number }> {
  vi.resetModules();
  const { handleHostedPlatformHttpRequest } = await import("./rest-handler.js");
  const server = createServer((req, res) => {
    void (async () => {
      const handled = await handleHostedPlatformHttpRequest(req, res);
      if (handled) {
        return;
      }
      res.statusCode = 404;
      res.end("not found");
    })().catch((error) => {
      res.statusCode = 500;
      res.end(String(error));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to resolve hosted test server port");
  }

  return { server, port: address.port };
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function bootstrapUser(params: {
  port: number;
  userId: string;
  adminToken?: string;
}): Promise<{ apiKey: string; body: Record<string, unknown> }> {
  const response = await fetch(`http://127.0.0.1:${params.port}/api/auth/bootstrap`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(params.adminToken ? { "x-admin-token": params.adminToken } : {}),
    },
    body: JSON.stringify({ userId: params.userId }),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (response.status !== 201 || typeof body.apiKey !== "string") {
    throw new Error(`bootstrap failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return { apiKey: body.apiKey, body };
}

async function readSecurityAuditEntries(): Promise<Array<Record<string, unknown>>> {
  const filePath = resolveHostedSecurityAuditLogPath(process.env);
  for (let i = 0; i < 25; i += 1) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const entries = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      if (entries.length > 0) {
        return entries;
      }
    } catch {
      // Wait for asynchronous audit writes.
    }
    await delay(20);
  }
  return [];
}

describe("handleHostedPlatformHttpRequest", () => {
  let tempStateDir = "";

  beforeEach(async () => {
    restoreProcessEnv(ORIGINAL_ENV);
    tempStateDir = await createTempStateDir();
    process.env.PROPAICLAW_MODE = "1";
    process.env.PROPAICLAW_STATE_DIR = tempStateDir;
    delete process.env.PROPAI_HOSTED_ADMIN_TOKEN;
    delete process.env.PROPAI_HOSTED_ALLOW_INSECURE_BOOTSTRAP;
    delete process.env.PROPAI_HOSTED_AUTH_RATE_LIMIT_MAX_ATTEMPTS;
    delete process.env.PROPAI_HOSTED_AUTH_RATE_LIMIT_WINDOW_MS;
    delete process.env.PROPAI_HOSTED_AUTH_RATE_LIMIT_LOCKOUT_MS;
    delete process.env.PROPAI_HOSTED_AUTH_RATE_LIMIT_EXEMPT_LOOPBACK;
  });

  afterEach(async () => {
    restoreProcessEnv(ORIGINAL_ENV);
    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
    }
  });

  it("returns health status for /api/health", async () => {
    const { server, port } = await startHostedApiServer();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        service: "hosted-platform",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("requires explicit bootstrap token policy in production when insecure mode is not allowed", async () => {
    process.env.NODE_ENV = "production";
    const { server, port } = await startHostedApiServer();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/bootstrap`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "tenant-prod" }),
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          type: "config_error",
        },
      });
    } finally {
      await stopServer(server);
    }
  });

  it("allows bootstrap in production only when insecure bootstrap override is explicitly enabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.PROPAI_HOSTED_ALLOW_INSECURE_BOOTSTRAP = "1";
    const { server, port } = await startHostedApiServer();
    try {
      const bootstrap = await bootstrapUser({ port, userId: "tenant-prod-ok" });
      expect(typeof bootstrap.apiKey).toBe("string");
      expect(bootstrap.apiKey.startsWith("pk_propai_")).toBe(true);
    } finally {
      await stopServer(server);
    }
  });

  it("blocks cross-user writes when body.userId does not match API key owner", async () => {
    const { server, port } = await startHostedApiServer();
    try {
      const bootstrap = await bootstrapUser({ port, userId: "tenant-one" });
      const response = await fetch(`http://127.0.0.1:${port}/api/keys`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": bootstrap.apiKey,
        },
        body: JSON.stringify({
          userId: "tenant-two",
          service: "openai",
          key: "sk-cross-user",
        }),
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: { type: "forbidden" },
      });
    } finally {
      await stopServer(server);
    }
  });

  it("returns invalid_request for malformed orchestrate payloads", async () => {
    const { server, port } = await startHostedApiServer();
    try {
      const bootstrap = await bootstrapUser({ port, userId: "tenant-orchestrate" });
      const response = await fetch(`http://127.0.0.1:${port}/api/orchestrate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": bootstrap.apiKey,
        },
        body: JSON.stringify({ task: "" }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { type: "invalid_request_error" },
      });
    } finally {
      await stopServer(server);
    }
  });

  it("rate limits repeated failed API auth attempts", async () => {
    process.env.PROPAI_HOSTED_AUTH_RATE_LIMIT_MAX_ATTEMPTS = "2";
    process.env.PROPAI_HOSTED_AUTH_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.PROPAI_HOSTED_AUTH_RATE_LIMIT_LOCKOUT_MS = "60000";
    process.env.PROPAI_HOSTED_AUTH_RATE_LIMIT_EXEMPT_LOOPBACK = "0";

    const { server, port } = await startHostedApiServer();
    try {
      const first = await fetch(`http://127.0.0.1:${port}/api/users/me`, {
        headers: { "x-api-key": "bad-1" },
      });
      const second = await fetch(`http://127.0.0.1:${port}/api/users/me`, {
        headers: { "x-api-key": "bad-2" },
      });
      const third = await fetch(`http://127.0.0.1:${port}/api/users/me`, {
        headers: { "x-api-key": "bad-3" },
      });

      expect(first.status).toBe(401);
      expect(second.status).toBe(401);
      expect(third.status).toBe(429);
    } finally {
      await stopServer(server);
    }
  });

  it("records security audit entries for failed authentication", async () => {
    const { server, port } = await startHostedApiServer();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/users/me`);
      expect(response.status).toBe(401);

      const entries = await readSecurityAuditEntries();
      expect(entries.some((entry) => entry.event === "api_auth_failed")).toBe(true);
    } finally {
      await stopServer(server);
    }
  });
});
