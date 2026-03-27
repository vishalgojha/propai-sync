const UNIT_MAP: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
  tb: 1024 * 1024 * 1024 * 1024,
  pb: 1024 * 1024 * 1024 * 1024 * 1024,
};

export function parseByteSize(
  value: string,
  options?: { defaultUnit?: keyof typeof UNIT_MAP },
): number {
  const raw = value.trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) {
    throw new Error(`Invalid byte size: ${value}`);
  }
  const amount = Number.parseFloat(match[1] ?? "0");
  const unit = (match[2] ?? options?.defaultUnit ?? "b") as keyof typeof UNIT_MAP;
  const multiplier = UNIT_MAP[unit];
  if (!multiplier || !Number.isFinite(amount)) {
    throw new Error(`Invalid byte size: ${value}`);
  }
  return Math.round(amount * multiplier);
}
