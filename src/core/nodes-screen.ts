import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type ScreenRecordPayload = {
  base64?: string;
  format?: string;
  durationMs?: number;
  hasAudio?: boolean;
  host?: string;
};

export function screenRecordTempPath(params: { ext: string }): string {
  const file = `propai-screen-${Date.now()}.${params.ext}`;
  return path.join(os.tmpdir(), file);
}

export function parseScreenRecordPayload(payload: unknown): ScreenRecordPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid screen record payload");
  }
  const raw = payload as Record<string, unknown>;
  return {
    base64: typeof raw.base64 === "string" ? raw.base64 : undefined,
    format: typeof raw.format === "string" ? raw.format : "mp4",
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : undefined,
    hasAudio: typeof raw.hasAudio === "boolean" ? raw.hasAudio : undefined,
    host: typeof raw.host === "string" ? raw.host : undefined,
  };
}

export async function writeScreenRecordToFile(params: {
  payload: ScreenRecordPayload;
  expectedHost?: string | null;
}): Promise<string> {
  const ext = params.payload.format ?? "mp4";
  const filePath = screenRecordTempPath({ ext });
  if (!params.payload.base64) {
    throw new Error("invalid screen record payload");
  }
  const buffer = Buffer.from(params.payload.base64, "base64");
  await fs.writeFile(filePath, buffer);
  return filePath;
}
