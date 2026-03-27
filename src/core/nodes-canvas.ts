import os from "node:os";
import path from "node:path";

export type CanvasSnapshotPayload = {
  base64: string;
  format: "png" | "jpeg";
};

export function canvasSnapshotTempPath(params: { ext: string }): string {
  const file = `propai-canvas-${Date.now()}.${params.ext}`;
  return path.join(os.tmpdir(), file);
}

export function parseCanvasSnapshotPayload(payload: unknown): CanvasSnapshotPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid canvas snapshot payload");
  }
  const raw = payload as Record<string, unknown>;
  const format =
    typeof raw.format === "string" && (raw.format === "jpeg" || raw.format === "png")
      ? (raw.format as "png" | "jpeg")
      : "png";
  const base64 = typeof raw.base64 === "string" ? raw.base64 : "";
  if (!base64) {
    throw new Error("invalid canvas snapshot payload");
  }
  return { base64, format };
}
