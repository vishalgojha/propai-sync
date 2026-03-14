#!/usr/bin/env bash
# One-time host setup for rootless PropAi Sync in Podman: creates the PropAi Sync
# user, builds the image, loads it into that user's Podman store, and installs
# the launch script. Run from repo root with sudo capability.
#
# Usage: ./setup-podman.sh [--quadlet|--container]
#   --quadlet   Install systemd Quadlet so the container runs as a user service
#   --container Only install user + image + launch script; you start the container manually (default)
#   Or set PROPAI_PODMAN_QUADLET=1 (or 0) to choose without a flag.
#
# After this, start the gateway manually:
#   ./scripts/run-propai-podman.sh launch
#   ./scripts/run-propai-podman.sh launch setup   # onboarding wizard
# Or as the PropAi Sync user: sudo -u PropAi Sync /home/propai/run-propai-podman.sh
# If you used --quadlet, you can also: sudo systemctl --machine propai@ --user start PropAi Sync.service
set -euo pipefail

PROPAI_USER="${PROPAI_PODMAN_USER:-PropAi Sync}"
REPO_PATH="${PROPAI_REPO_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
RUN_SCRIPT_SRC="$REPO_PATH/scripts/run-propai-podman.sh"
QUADLET_TEMPLATE="$REPO_PATH/scripts/podman/propai.container.in"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

is_writable_dir() {
  local dir="$1"
  [[ -n "$dir" && -d "$dir" && ! -L "$dir" && -w "$dir" && -x "$dir" ]]
}

is_safe_tmp_base() {
  local dir="$1"
  local mode=""
  local owner=""
  is_writable_dir "$dir" || return 1
  mode="$(stat -Lc '%a' "$dir" 2>/dev/null || true)"
  if [[ -n "$mode" ]]; then
    local perm=$((8#$mode))
    if (( (perm & 0022) != 0 && (perm & 01000) == 0 )); then
      return 1
    fi
  fi
  if is_root; then
    owner="$(stat -Lc '%u' "$dir" 2>/dev/null || true)"
    if [[ -n "$owner" && "$owner" != "0" ]]; then
      return 1
    fi
  fi
  return 0
}

resolve_image_tmp_dir() {
  if ! is_root && is_safe_tmp_base "${TMPDIR:-}"; then
    printf '%s' "$TMPDIR"
    return 0
  fi
  if is_safe_tmp_base "/var/tmp"; then
    printf '%s' "/var/tmp"
    return 0
  fi
  if is_safe_tmp_base "/tmp"; then
    printf '%s' "/tmp"
    return 0
  fi
  printf '%s' "/tmp"
}

is_root() { [[ "$(id -u)" -eq 0 ]]; }

run_root() {
  if is_root; then
    "$@"
  else
    sudo "$@"
  fi
}

run_as_user() {
  # When switching users, the caller's cwd may be inaccessible to the target
  # user (e.g. a private home dir). Wrap in a subshell that cd's to a
  # world-traversable directory so sudo/runuser don't fail with "cannot chdir".
  # TODO: replace with fully rootless podman build to eliminate the need for
  # user-switching entirely.
  local user="$1"
  shift
  if command -v sudo >/dev/null 2>&1; then
    ( cd /tmp 2>/dev/null || cd /; sudo -u "$user" "$@" )
  elif is_root && command -v runuser >/dev/null 2>&1; then
    ( cd /tmp 2>/dev/null || cd /; runuser -u "$user" -- "$@" )
  else
    echo "Need sudo (or root+runuser) to run commands as $user." >&2
    exit 1
  fi
}

run_as_PropAi Sync() {
  # Avoid root writes into $PROPAI_HOME (symlink/hardlink/TOCTOU footguns).
  # Anything under the target user's home should be created/modified as that user.
  run_as_user "$PROPAI_USER" env HOME="$PROPAI_HOME" "$@"
}

escape_sed_replacement_pipe_delim() {
  # Escape replacement metacharacters for sed "s|...|...|g" replacement text.
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

# Quadlet: opt-in via --quadlet or PROPAI_PODMAN_QUADLET=1
INSTALL_QUADLET=false
for arg in "$@"; do
  case "$arg" in
    --quadlet)   INSTALL_QUADLET=true ;;
    --container) INSTALL_QUADLET=false ;;
  esac
done
if [[ -n "${PROPAI_PODMAN_QUADLET:-}" ]]; then
  case "${PROPAI_PODMAN_QUADLET,,}" in
    1|yes|true)  INSTALL_QUADLET=true ;;
    0|no|false) INSTALL_QUADLET=false ;;
  esac
fi

require_cmd podman
if ! is_root; then
  require_cmd sudo
fi
if [[ ! -f "$REPO_PATH/Dockerfile" ]]; then
  echo "Dockerfile not found at $REPO_PATH. Set PROPAI_REPO_PATH to the repo root." >&2
  exit 1
fi
if [[ ! -f "$RUN_SCRIPT_SRC" ]]; then
  echo "Launch script not found at $RUN_SCRIPT_SRC." >&2
  exit 1
fi

generate_token_hex_32() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
    return 0
  fi
  if command -v od >/dev/null 2>&1; then
    # 32 random bytes -> 64 lowercase hex chars
    od -An -N32 -tx1 /dev/urandom | tr -d " \n"
    return 0
  fi
  echo "Missing dependency: need openssl or python3 (or od) to generate PROPAI_GATEWAY_TOKEN." >&2
  exit 1
}

user_exists() {
  local user="$1"
  if command -v getent >/dev/null 2>&1; then
    getent passwd "$user" >/dev/null 2>&1 && return 0
  fi
  id -u "$user" >/dev/null 2>&1
}

resolve_user_home() {
  local user="$1"
  local home=""
  if command -v getent >/dev/null 2>&1; then
    home="$(getent passwd "$user" 2>/dev/null | cut -d: -f6 || true)"
  fi
  if [[ -z "$home" && -f /etc/passwd ]]; then
    home="$(awk -F: -v u="$user" '$1==u {print $6}' /etc/passwd 2>/dev/null || true)"
  fi
  if [[ -z "$home" ]]; then
    home="/home/$user"
  fi
  printf '%s' "$home"
}

resolve_nologin_shell() {
  for cand in /usr/sbin/nologin /sbin/nologin /usr/bin/nologin /bin/false; do
    if [[ -x "$cand" ]]; then
      printf '%s' "$cand"
      return 0
    fi
  done
  printf '%s' "/usr/sbin/nologin"
}

# Create PropAi Sync user (non-login, with home) if missing
if ! user_exists "$PROPAI_USER"; then
  NOLOGIN_SHELL="$(resolve_nologin_shell)"
  echo "Creating user $PROPAI_USER ($NOLOGIN_SHELL, with home)..."
  if command -v useradd >/dev/null 2>&1; then
    run_root useradd -m -s "$NOLOGIN_SHELL" "$PROPAI_USER"
  elif command -v adduser >/dev/null 2>&1; then
    # Debian/Ubuntu: adduser supports --disabled-password/--gecos. Busybox adduser differs.
    run_root adduser --disabled-password --gecos "" --shell "$NOLOGIN_SHELL" "$PROPAI_USER"
  else
    echo "Neither useradd nor adduser found, cannot create user $PROPAI_USER." >&2
    exit 1
  fi
else
  echo "User $PROPAI_USER already exists."
fi

PROPAI_HOME="$(resolve_user_home "$PROPAI_USER")"
PROPAI_UID="$(id -u "$PROPAI_USER" 2>/dev/null || true)"
PROPAI_CONFIG="$PROPAI_HOME/.propai"
LAUNCH_SCRIPT_DST="$PROPAI_HOME/run-propai-podman.sh"

# Prefer systemd user services (Quadlet) for production. Enable lingering early so rootless Podman can run
# without an interactive login.
if command -v loginctl &>/dev/null; then
  run_root loginctl enable-linger "$PROPAI_USER" 2>/dev/null || true
fi
if [[ -n "${PROPAI_UID:-}" && -d /run/user ]] && command -v systemctl &>/dev/null; then
  run_root systemctl start "user@${PROPAI_UID}.service" 2>/dev/null || true
fi

# Rootless Podman needs subuid/subgid for the run user
if ! grep -q "^${PROPAI_USER}:" /etc/subuid 2>/dev/null; then
  echo "Warning: $PROPAI_USER has no subuid range. Rootless Podman may fail." >&2
  echo "  Add a line to /etc/subuid and /etc/subgid, e.g.: $PROPAI_USER:100000:65536" >&2
fi

echo "Creating $PROPAI_CONFIG and workspace..."
run_as_PropAi Sync mkdir -p "$PROPAI_CONFIG/workspace"
run_as_PropAi Sync chmod 700 "$PROPAI_CONFIG" "$PROPAI_CONFIG/workspace" 2>/dev/null || true

ENV_FILE="$PROPAI_CONFIG/.env"
if run_as_PropAi Sync test -f "$ENV_FILE"; then
  if ! run_as_PropAi Sync grep -q '^PROPAI_GATEWAY_TOKEN=' "$ENV_FILE" 2>/dev/null; then
    TOKEN="$(generate_token_hex_32)"
    printf 'PROPAI_GATEWAY_TOKEN=%s\n' "$TOKEN" | run_as_PropAi Sync tee -a "$ENV_FILE" >/dev/null
    echo "Added PROPAI_GATEWAY_TOKEN to $ENV_FILE."
  fi
  run_as_PropAi Sync chmod 600 "$ENV_FILE" 2>/dev/null || true
else
  TOKEN="$(generate_token_hex_32)"
  printf 'PROPAI_GATEWAY_TOKEN=%s\n' "$TOKEN" | run_as_PropAi Sync tee "$ENV_FILE" >/dev/null
  run_as_PropAi Sync chmod 600 "$ENV_FILE" 2>/dev/null || true
  echo "Created $ENV_FILE with new token."
fi

# The gateway refuses to start unless gateway.mode=local is set in config.
# Make first-run non-interactive; users can run the wizard later to configure channels/providers.
PROPAI_JSON="$PROPAI_CONFIG/propai.json"
if ! run_as_PropAi Sync test -f "$PROPAI_JSON"; then
  printf '%s\n' '{ gateway: { mode: "local" } }' | run_as_PropAi Sync tee "$PROPAI_JSON" >/dev/null
  run_as_PropAi Sync chmod 600 "$PROPAI_JSON" 2>/dev/null || true
  echo "Created $PROPAI_JSON (minimal gateway.mode=local)."
fi

echo "Building image from $REPO_PATH..."
BUILD_ARGS=()
[[ -n "${PROPAI_DOCKER_APT_PACKAGES:-}" ]] && BUILD_ARGS+=(--build-arg "PROPAI_DOCKER_APT_PACKAGES=${PROPAI_DOCKER_APT_PACKAGES}")
[[ -n "${PROPAI_EXTENSIONS:-}" ]] && BUILD_ARGS+=(--build-arg "PROPAI_EXTENSIONS=${PROPAI_EXTENSIONS}")
podman build ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} -t propai:local -f "$REPO_PATH/Dockerfile" "$REPO_PATH"

echo "Loading image into $PROPAI_USER's Podman store..."
TMP_IMAGE_DIR="$(resolve_image_tmp_dir)"
echo "Using temporary image dir: $TMP_IMAGE_DIR"
TMP_STAGE_DIR="$(mktemp -d -p "$TMP_IMAGE_DIR" propai-image.XXXXXX)"
TMP_IMAGE="$TMP_STAGE_DIR/image.tar"
chmod 700 "$TMP_STAGE_DIR"
trap 'rm -rf "$TMP_STAGE_DIR"' EXIT
podman save propai:local -o "$TMP_IMAGE"
chmod 600 "$TMP_IMAGE"
# Stream the image into the target user's podman load so private temp directories
# do not need to be traversable by $PROPAI_USER.
cat "$TMP_IMAGE" | run_as_user "$PROPAI_USER" env HOME="$PROPAI_HOME" podman load
rm -rf "$TMP_STAGE_DIR"
trap - EXIT

echo "Copying launch script to $LAUNCH_SCRIPT_DST..."
run_root cat "$RUN_SCRIPT_SRC" | run_as_PropAi Sync tee "$LAUNCH_SCRIPT_DST" >/dev/null
run_as_PropAi Sync chmod 755 "$LAUNCH_SCRIPT_DST"

# Optionally install systemd quadlet for PropAi Sync user (rootless Podman + systemd)
QUADLET_DIR="$PROPAI_HOME/.config/containers/systemd"
if [[ "$INSTALL_QUADLET" == true && -f "$QUADLET_TEMPLATE" ]]; then
  echo "Installing systemd quadlet for $PROPAI_USER..."
  run_as_PropAi Sync mkdir -p "$QUADLET_DIR"
  PROPAI_HOME_SED="$(escape_sed_replacement_pipe_delim "$PROPAI_HOME")"
  sed "s|{{PROPAI_HOME}}|$PROPAI_HOME_SED|g" "$QUADLET_TEMPLATE" | run_as_PropAi Sync tee "$QUADLET_DIR/PropAiSync.container" >/dev/null
  run_as_PropAi Sync chmod 700 "$PROPAI_HOME/.config" "$PROPAI_HOME/.config/containers" "$QUADLET_DIR" 2>/dev/null || true
  run_as_PropAi Sync chmod 600 "$QUADLET_DIR/PropAiSync.container" 2>/dev/null || true
  if command -v systemctl &>/dev/null; then
    run_root systemctl --machine "${PROPAI_USER}@" --user daemon-reload 2>/dev/null || true
    run_root systemctl --machine "${PROPAI_USER}@" --user enable PropAi Sync.service 2>/dev/null || true
    run_root systemctl --machine "${PROPAI_USER}@" --user start PropAi Sync.service 2>/dev/null || true
  fi
fi

echo ""
echo "Setup complete. Start the gateway:"
echo "  $RUN_SCRIPT_SRC launch"
echo "  $RUN_SCRIPT_SRC launch setup   # onboarding wizard"
echo "Or as $PROPAI_USER (e.g. from cron):"
echo "  sudo -u $PROPAI_USER $LAUNCH_SCRIPT_DST"
echo "  sudo -u $PROPAI_USER $LAUNCH_SCRIPT_DST setup"
if [[ "$INSTALL_QUADLET" == true ]]; then
  echo "Or use systemd (quadlet):"
  echo "  sudo systemctl --machine ${PROPAI_USER}@ --user start PropAi Sync.service"
  echo "  sudo systemctl --machine ${PROPAI_USER}@ --user status PropAi Sync.service"
else
  echo "To install systemd quadlet later: $0 --quadlet"
fi







