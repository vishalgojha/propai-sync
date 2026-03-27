const UNIT_MAP: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
  tb: 1024 * 1024 * 1024 * 1024,
};

export function parseByteSize(value: string): number {
  const raw = value.trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) {
    throw new Error(`Invalid byte size: ${value}`);
  }
  const amount = Number.parseFloat(match[1] ?? "0");
  const unit = match[2] ?? "b";
  const multiplier = UNIT_MAP[unit];
  if (!multiplier || !Number.isFinite(amount)) {
    throw new Error(`Invalid byte size: ${value}`);
  }
  return Math.round(amount * multiplier);
}
