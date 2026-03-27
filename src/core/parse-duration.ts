const UNIT_MAP: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationMs(
  value: string,
  options?: { defaultUnit?: keyof typeof UNIT_MAP },
): number {
  const raw = value.trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/);
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }
  const amount = Number.parseFloat(match[1] ?? "0");
  const unit = (match[2] ?? options?.defaultUnit ?? "ms") as keyof typeof UNIT_MAP;
  const multiplier = UNIT_MAP[unit];
  if (!multiplier || !Number.isFinite(amount)) {
    throw new Error(`Invalid duration: ${value}`);
  }
  return Math.round(amount * multiplier);
}
