#!/usr/bin/env node
import { execSync } from "node:child_process";
import process from "node:process";

const API_ROOT = "https://api.github.com";
const WORKFLOW_FILE = "install-smoke.yml";

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/install-smoke-ci.mjs dispatch [--repo owner/repo] [--ref branch] [--full]",
      "  node scripts/install-smoke-ci.mjs status [--repo owner/repo] [--limit N] [--branch name]",
      "",
      "Auth:",
      "  Set GH_TOKEN or GITHUB_TOKEN for workflow dispatch and higher rate limits.",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const [command, ...rest] = argv.slice(2);
  const options = {
    repo: "",
    ref: "",
    full: false,
    branch: "",
    limit: 10,
  };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--repo") {
      options.repo = rest[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--ref") {
      options.ref = rest[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--branch") {
      options.branch = rest[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--limit") {
      const parsed = Number.parseInt(rest[i + 1] ?? "", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--full") {
      options.full = true;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { command: command ?? "", options };
}

function parseRepoFromUrl(raw) {
  const trimmed = raw.trim();
  const sshMatch = trimmed.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/i);
  if (sshMatch?.groups?.owner && sshMatch?.groups?.repo) {
    return `${sshMatch.groups.owner}/${sshMatch.groups.repo}`;
  }
  return "";
}

function resolveRepo(input) {
  if (input) {
    return input;
  }
  try {
    const remote = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = parseRepoFromUrl(remote);
    if (parsed) {
      return parsed;
    }
  } catch {
    // ignore
  }
  throw new Error("Could not resolve GitHub repo. Pass --repo owner/repo.");
}

function resolveRef(input) {
  if (input) {
    return input;
  }
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (branch && branch !== "HEAD") {
      return branch;
    }
  } catch {
    // ignore
  }
  return "main";
}

function resolveToken() {
  return process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
}

async function githubRequest(params) {
  const token = resolveToken();
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "openclaw-install-smoke",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_ROOT}${params.path}`, {
    method: params.method,
    headers,
    body: params.body ? JSON.stringify(params.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${params.method} ${params.path} failed (${res.status}): ${text}`);
  }
  if (res.status === 204) {
    return null;
  }
  return await res.json();
}

async function dispatchInstallSmoke(options) {
  const token = resolveToken();
  if (!token) {
    throw new Error("GH_TOKEN or GITHUB_TOKEN is required for workflow dispatch.");
  }
  const repo = resolveRepo(options.repo);
  const ref = resolveRef(options.ref);
  const inputs = options.full ? { full: "true" } : undefined;
  await githubRequest({
    method: "POST",
    path: `/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    body: {
      ref,
      inputs,
    },
  });
  console.log(`Dispatched ${WORKFLOW_FILE} for ${repo}@${ref}${options.full ? " (full)" : ""}.`);
}

function formatRunLine(run) {
  const updated = String(run.updated_at ?? "")
    .replace("T", " ")
    .replace("Z", " UTC");
  const conclusion = run.conclusion ?? "-";
  return [
    `#${run.run_number} id=${run.id}`,
    `status=${run.status}`,
    `conclusion=${conclusion}`,
    `event=${run.event}`,
    `branch=${run.head_branch}`,
    `updated=${updated}`,
    String(run.html_url ?? ""),
  ].join(" | ");
}

async function printInstallSmokeStatus(options) {
  const repo = resolveRepo(options.repo);
  const limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : 10;
  const data = await githubRequest({
    method: "GET",
    path: `/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=${limit}`,
  });
  const runs = Array.isArray(data?.workflow_runs) ? data.workflow_runs : [];
  const filtered = options.branch
    ? runs.filter((run) => String(run.head_branch ?? "") === options.branch)
    : runs;
  if (filtered.length === 0) {
    console.log(
      `No ${WORKFLOW_FILE} runs found for ${repo}${options.branch ? ` on ${options.branch}` : ""}.`,
    );
    return;
  }
  for (const run of filtered) {
    console.log(formatRunLine(run));
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv);
  if (!command || command === "-h" || command === "--help") {
    usage();
    process.exit(command ? 0 : 1);
  }
  if (command === "dispatch") {
    await dispatchInstallSmoke(options);
    return;
  }
  if (command === "status") {
    await printInstallSmokeStatus(options);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
