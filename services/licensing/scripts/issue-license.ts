type IssueLicensePayload = {
  token?: string;
  plan?: string;
  status?: string;
  expiresAt?: string | null;
  maxDevices?: number;
};

const DEFAULT_API_URL = "http://localhost:8787";

const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const idx = args.indexOf(flag);
  if (idx === -1) {
    return null;
  }
  return args[idx + 1] ?? null;
};

const apiUrl = getArg("--api-url") ?? process.env.LICENSE_API_URL ?? DEFAULT_API_URL;
const adminKey =
  getArg("--admin-key") ?? process.env.LICENSE_ADMIN_KEY ?? process.env.ADMIN_KEY ?? "";

if (!adminKey.trim()) {
  console.error("Missing admin key. Set LICENSE_ADMIN_KEY or ADMIN_KEY.");
  process.exit(1);
}

const payload: IssueLicensePayload = {
  token: getArg("--token") ?? undefined,
  plan: getArg("--plan") ?? undefined,
  status: getArg("--status") ?? undefined,
  expiresAt: getArg("--expires-at") ?? undefined,
  maxDevices: getArg("--max-devices") ? Number(getArg("--max-devices")) : undefined,
};

const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/v1/admin/licenses`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-admin-key": adminKey,
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const text = await response.text();
  console.error(`Request failed (${response.status}): ${text}`);
  process.exit(1);
}

const data = (await response.json()) as {
  ok?: boolean;
  token?: string;
  plan?: string;
  status?: string;
  expiresAt?: string | null;
  maxDevices?: number;
};

if (!data.token) {
  console.error("No token returned.");
  process.exit(1);
}

console.log(data.token);
