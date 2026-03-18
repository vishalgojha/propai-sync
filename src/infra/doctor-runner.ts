import process from "node:process";
import { doctorCommand } from "../commands/doctor.js";
import { loadDotEnv } from "./dotenv.js";
import { normalizeEnv } from "./env.js";
import { assertSupportedRuntime } from "./runtime-guard.js";
import { enableConsoleCapture } from "../logging.js";
import { defaultRuntime } from "../runtime.js";

async function runDoctor(): Promise<void> {
  loadDotEnv({ quiet: true });
  normalizeEnv();
  enableConsoleCapture();
  assertSupportedRuntime();

  await doctorCommand(defaultRuntime, { nonInteractive: true, repair: true });
}

void runDoctor().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`doctor: failed: ${message}`);
  process.exit(1);
});
