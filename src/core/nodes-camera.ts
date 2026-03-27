import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type CameraFacing = "front" | "back";

export type CameraSnapPayload = {
  base64?: string;
  format: string;
  width?: number;
  height?: number;
  host?: string;
};

export type CameraClipPayload = {
  base64?: string;
  format?: string;
  durationMs?: number;
  hasAudio?: boolean;
  host?: string;
};

export function cameraTempPath(params: { kind: "snap" | "clip"; facing: CameraFacing; ext: string }): string {
  const file = `propai-${params.kind}-${params.facing}-${Date.now()}.${params.ext}`;
  return path.join(os.tmpdir(), file);
}

export function parseCameraSnapPayload(payload: unknown): CameraSnapPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid camera snap payload");
  }
  const raw = payload as Record<string, unknown>;
  const format = typeof raw.format === "string" ? raw.format : "jpg";
  return {
    base64: typeof raw.base64 === "string" ? raw.base64 : undefined,
    format,
    width: typeof raw.width === "number" ? raw.width : undefined,
    height: typeof raw.height === "number" ? raw.height : undefined,
    host: typeof raw.host === "string" ? raw.host : undefined,
  };
}

export function parseCameraClipPayload(payload: unknown): CameraClipPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid camera clip payload");
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

export async function writeBase64ToFile(filePath: string, base64: string): Promise<void> {
  const buffer = Buffer.from(base64, "base64");
  await fs.writeFile(filePath, buffer);
}

export async function writeCameraPayloadToFile(params: {
  filePath: string;
  payload: CameraSnapPayload;
  expectedHost?: string | null;
  invalidPayloadMessage?: string;
}): Promise<void> {
  if (!params.payload.base64) {
    throw new Error(params.invalidPayloadMessage ?? "invalid camera payload");
  }
  await writeBase64ToFile(params.filePath, params.payload.base64);
}

export async function writeCameraClipPayloadToFile(params: {
  payload: CameraClipPayload;
  facing: CameraFacing;
  expectedHost?: string | null;
}): Promise<string> {
  const ext = params.payload.format ?? "mp4";
  const filePath = cameraTempPath({ kind: "clip", facing: params.facing, ext });
  if (!params.payload.base64) {
    throw new Error("invalid camera clip payload");
  }
  await writeBase64ToFile(filePath, params.payload.base64);
  return filePath;
}
