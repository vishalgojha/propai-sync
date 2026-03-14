#!/usr/bin/env bash
set -euo pipefail

cd /repo

export PROPAI_STATE_DIR="/tmp/propai-test"
export PROPAI_CONFIG_PATH="${PROPAI_STATE_DIR}/propai.json"

echo "==> Build"
pnpm build

echo "==> Seed state"
mkdir -p "${PROPAI_STATE_DIR}/credentials"
mkdir -p "${PROPAI_STATE_DIR}/agents/main/sessions"
echo '{}' >"${PROPAI_CONFIG_PATH}"
echo 'creds' >"${PROPAI_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${PROPAI_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm PropAi Sync reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${PROPAI_CONFIG_PATH}"
test ! -d "${PROPAI_STATE_DIR}/credentials"
test ! -d "${PROPAI_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${PROPAI_STATE_DIR}/credentials"
echo '{}' >"${PROPAI_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm PropAi Sync uninstall --state --yes --non-interactive

test ! -d "${PROPAI_STATE_DIR}"

echo "OK"


