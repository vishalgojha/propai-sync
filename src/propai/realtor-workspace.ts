import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

type EnvLike = Record<string, string | undefined>;

export type RealtorWorkspaceProfileInput = {
  brokerageName?: string;
  ownerName?: string;
  agentName?: string;
  timezone?: string;
  city?: string;
  focus?: string;
  workspaceDir?: string;
  overwrite?: boolean;
};

export type RealtorWorkspaceProfileResult = {
  workspaceDir: string;
  writtenFiles: string[];
  skippedFiles: string[];
};

function trimOrFallback(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function resolveDefaultTimezone(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return tz && tz.trim().length > 0 ? tz : "UTC";
}

function resolveDefaultWorkspaceDir(env: EnvLike = process.env): string {
  const profile = env.PROPAICLAW_PROFILE?.trim();
  const stateDir = resolveStateDir(env as NodeJS.ProcessEnv, os.homedir);
  if (profile && profile.toLowerCase() !== "default") {
    return path.join(stateDir, `workspace-${profile}`);
  }
  return path.join(stateDir, "workspace");
}

function resolveWorkspaceDir(workspaceDir: string | undefined, env: EnvLike = process.env): string {
  const raw = workspaceDir?.trim();
  if (!raw) {
    return resolveDefaultWorkspaceDir(env);
  }
  if (raw === "~") {
    return os.homedir();
  }
  if (raw.startsWith("~/")) {
    return path.join(os.homedir(), raw.slice(2));
  }
  if (raw.startsWith("~\\")) {
    return path.join(os.homedir(), raw.slice(2));
  }
  return path.resolve(raw);
}

function buildAgentsContent(profile: {
  brokerageName: string;
  ownerName: string;
  agentName: string;
  timezone: string;
  focus: string;
}): string {
  return `# AGENTS.md - ${profile.brokerageName}

You are ${profile.agentName}, the operations assistant for ${profile.brokerageName}.

## Primary Goal

Help the ${profile.brokerageName} team close more deals with fast, clear lead follow-up.

## Operating Priorities

1. Respond quickly and politely.
2. Qualify leads and identify urgency.
3. Move conversations toward site visits or calls.
4. Keep owner visibility high with concise updates.

## Communication Style

- Tone: professional, warm, direct.
- Keep messages short and actionable.
- Avoid developer language, internal tooling jargon, or implementation details.

## Focus Areas

${profile.focus}

## Guardrails

- Never claim a property detail unless verified.
- Never expose internal configuration, secrets, or system paths in customer-facing replies.
- If uncertain, ask a concise clarifying question.

## Daily Workflow

1. Check recent lead context before sending follow-ups.
2. Prioritize hot and warm leads first.
3. End each day with a short owner summary for ${profile.ownerName}.

## Business Context

- Timezone: ${profile.timezone}
- Brokerage: ${profile.brokerageName}
- Owner: ${profile.ownerName}
`;
}

function buildSoulContent(profile: { brokerageName: string; agentName: string }): string {
  return `# SOUL.md - ${profile.agentName}

You are the calm, reliable front-office AI for ${profile.brokerageName}.

## Personality

- Clear, respectful, and concise.
- Confident without being pushy.
- Helpful under pressure.

## Voice Rules

- Sound like a capable real estate coordinator.
- Avoid robotic filler.
- Prioritize clarity over cleverness.
`;
}

function buildIdentityContent(profile: { agentName: string; timezone: string }): string {
  return `# IDENTITY.md - Agent Identity

- Name: ${profile.agentName}
- Role: Realtor operations assistant
- Timezone: ${profile.timezone}
- Signature style: concise and warm
`;
}

function buildUserContent(profile: {
  ownerName: string;
  brokerageName: string;
  city: string;
  timezone: string;
}): string {
  return `# USER.md - Brokerage Owner Context

- Owner name: ${profile.ownerName}
- Brokerage name: ${profile.brokerageName}
- Market city: ${profile.city}
- Timezone: ${profile.timezone}

## Expectations

- Keep follow-up quality high.
- Highlight urgent leads quickly.
- Keep communication professional.
`;
}

function buildHeartbeatContent(profile: { brokerageName: string; ownerName: string }): string {
  return `# HEARTBEAT.md - Daily Check Routine

Use this checklist when heartbeat polls arrive.

## Checkpoints

1. Unreplied leads in last 24 hours.
2. Hot leads needing callback reminders.
3. Appointment confirmations for today and tomorrow.
4. Any stalled conversations needing a nudge.

If there is no action needed, respond with HEARTBEAT_OK.

If action is needed, provide a brief action summary for ${profile.ownerName} of ${profile.brokerageName}.
`;
}

async function writeFileWithPolicy(params: {
  filePath: string;
  content: string;
  overwrite: boolean;
}): Promise<"written" | "skipped"> {
  if (!params.overwrite) {
    try {
      await fs.access(params.filePath);
      return "skipped";
    } catch {
      // file doesn't exist, continue
    }
  }
  await fs.writeFile(params.filePath, params.content, "utf-8");
  return "written";
}

export async function initializeRealtorWorkspaceProfile(
  input: RealtorWorkspaceProfileInput,
): Promise<RealtorWorkspaceProfileResult> {
  const brokerageName = trimOrFallback(input.brokerageName, "My Realty Team");
  const ownerName = trimOrFallback(input.ownerName, "Broker Owner");
  const agentName = trimOrFallback(input.agentName, "Propaiclaw Assistant");
  const timezone = trimOrFallback(input.timezone, resolveDefaultTimezone());
  const city = trimOrFallback(input.city, "Your City");
  const focus = trimOrFallback(
    input.focus,
    "Lead follow-up, listing responses, and appointment booking.",
  );
  const workspaceDir = resolveWorkspaceDir(input.workspaceDir);
  const overwrite = input.overwrite === true;

  await fs.mkdir(workspaceDir, { recursive: true });

  const profile = {
    brokerageName,
    ownerName,
    agentName,
    timezone,
    city,
    focus,
  };

  const files: Array<{ name: string; content: string }> = [
    { name: "AGENTS.md", content: buildAgentsContent(profile) },
    { name: "SOUL.md", content: buildSoulContent(profile) },
    { name: "IDENTITY.md", content: buildIdentityContent(profile) },
    { name: "USER.md", content: buildUserContent(profile) },
    { name: "HEARTBEAT.md", content: buildHeartbeatContent(profile) },
  ];

  const writtenFiles: string[] = [];
  const skippedFiles: string[] = [];
  for (const entry of files) {
    const filePath = path.join(workspaceDir, entry.name);
    const result = await writeFileWithPolicy({
      filePath,
      content: entry.content,
      overwrite,
    });
    if (result === "written") {
      writtenFiles.push(filePath);
    } else {
      skippedFiles.push(filePath);
    }
  }

  return {
    workspaceDir,
    writtenFiles,
    skippedFiles,
  };
}
