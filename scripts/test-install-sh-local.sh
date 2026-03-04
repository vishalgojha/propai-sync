#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "SKIP: docker is not installed; skipping local install smoke."
  echo "Run pnpm test:install:smoke:strict after Docker is installed."
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "SKIP: docker daemon is not reachable; skipping local install smoke."
  echo "Start Docker Desktop (or docker engine), then run pnpm test:install:smoke:strict."
  exit 0
fi

exec bash "$ROOT_DIR/scripts/test-install-sh-docker.sh"
