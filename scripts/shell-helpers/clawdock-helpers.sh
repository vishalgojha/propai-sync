#!/usr/bin/env bash
# ClawDock - Docker helpers for PropAi Sync
# Inspired by Simon Willison's "Running PropAi Sync in Docker"
# https://til.simonwillison.net/llms/propai-docker
#
# Installation:
#   mkdir -p ~/.clawdock && curl -sL https://raw.githubusercontent.com/propai/propai/main/scripts/shell-helpers/clawdock-helpers.sh -o ~/.clawdock/clawdock-helpers.sh
#   echo 'source ~/.clawdock/clawdock-helpers.sh' >> ~/.zshrc
#
# Usage:
#   clawdock-help    # Show all available commands

# =============================================================================
# Colors
# =============================================================================
_CLR_RESET='\033[0m'
_CLR_BOLD='\033[1m'
_CLR_DIM='\033[2m'
_CLR_GREEN='\033[0;32m'
_CLR_YELLOW='\033[1;33m'
_CLR_BLUE='\033[0;34m'
_CLR_MAGENTA='\033[0;35m'
_CLR_CYAN='\033[0;36m'
_CLR_RED='\033[0;31m'

# Styled command output (green + bold)
_clr_cmd() {
  echo -e "${_CLR_GREEN}${_CLR_BOLD}$1${_CLR_RESET}"
}

# Inline command for use in sentences
_cmd() {
  echo "${_CLR_GREEN}${_CLR_BOLD}$1${_CLR_RESET}"
}

# =============================================================================
# Config
# =============================================================================
CLAWDOCK_CONFIG="${HOME}/.clawdock/config"

# Common paths to check for PropAi Sync
CLAWDOCK_COMMON_PATHS=(
  "${HOME}/PropAiSync"
  "${HOME}/workspace/PropAiSync"
  "${HOME}/projects/PropAiSync"
  "${HOME}/dev/PropAiSync"
  "${HOME}/code/PropAiSync"
  "${HOME}/src/PropAiSync"
)

_clawdock_filter_warnings() {
  grep -v "^WARN\|^time="
}

_clawdock_trim_quotes() {
  local value="$1"
  value="${value#\"}"
  value="${value%\"}"
  printf "%s" "$value"
}

_clawdock_read_config_dir() {
  if [[ ! -f "$CLAWDOCK_CONFIG" ]]; then
    return 1
  fi
  local raw
  raw=$(sed -n 's/^CLAWDOCK_DIR=//p' "$CLAWDOCK_CONFIG" | head -n 1)
  if [[ -z "$raw" ]]; then
    return 1
  fi
  _clawdock_trim_quotes "$raw"
}

# Ensure CLAWDOCK_DIR is set and valid
_clawdock_ensure_dir() {
  # Already set and valid?
  if [[ -n "$CLAWDOCK_DIR" && -f "${CLAWDOCK_DIR}/docker-compose.yml" ]]; then
    return 0
  fi

  # Try loading from config
  local config_dir
  config_dir=$(_clawdock_read_config_dir)
  if [[ -n "$config_dir" && -f "${config_dir}/docker-compose.yml" ]]; then
    CLAWDOCK_DIR="$config_dir"
    return 0
  fi

  # Auto-detect from common paths
  local found_path=""
  for path in "${CLAWDOCK_COMMON_PATHS[@]}"; do
    if [[ -f "${path}/docker-compose.yml" ]]; then
      found_path="$path"
      break
    fi
  done

  if [[ -n "$found_path" ]]; then
    echo ""
    echo "🦞 Found PropAi Sync at: $found_path"
    echo -n "   Use this location? [Y/n] "
    read -r response
    if [[ "$response" =~ ^[Nn] ]]; then
      echo ""
      echo "Set CLAWDOCK_DIR manually:"
      echo "  export CLAWDOCK_DIR=/path/to/PropAiSync"
      return 1
    fi
    CLAWDOCK_DIR="$found_path"
  else
    echo ""
    echo "❌ PropAi Sync not found in common locations."
    echo ""
    echo "Clone it first:"
    echo ""
    echo "  git clone https://github.com/propai/propai.git ~/PropAiSync"
    echo "  cd ~/PropAiSync && ./docker-setup.sh"
    echo ""
    echo "Or set CLAWDOCK_DIR if it's elsewhere:"
    echo ""
    echo "  export CLAWDOCK_DIR=/path/to/PropAiSync"
    echo ""
    return 1
  fi

  # Save to config
  if [[ ! -d "${HOME}/.clawdock" ]]; then
    /bin/mkdir -p "${HOME}/.clawdock"
  fi
  echo "CLAWDOCK_DIR=\"$CLAWDOCK_DIR\"" > "$CLAWDOCK_CONFIG"
  echo "✅ Saved to $CLAWDOCK_CONFIG"
  echo ""
  return 0
}

# Wrapper to run docker compose commands
_clawdock_compose() {
  _clawdock_ensure_dir || return 1
  local compose_args=(-f "${CLAWDOCK_DIR}/docker-compose.yml")
  if [[ -f "${CLAWDOCK_DIR}/docker-compose.extra.yml" ]]; then
    compose_args+=(-f "${CLAWDOCK_DIR}/docker-compose.extra.yml")
  fi
  command docker compose "${compose_args[@]}" "$@"
}

_clawdock_read_env_token() {
  _clawdock_ensure_dir || return 1
  if [[ ! -f "${CLAWDOCK_DIR}/.env" ]]; then
    return 1
  fi
  local raw
  raw=$(sed -n 's/^PROPAI_GATEWAY_TOKEN=//p' "${CLAWDOCK_DIR}/.env" | head -n 1)
  if [[ -z "$raw" ]]; then
    return 1
  fi
  _clawdock_trim_quotes "$raw"
}

# Basic Operations
clawdock-start() {
  _clawdock_compose up -d propai-gateway
}

clawdock-stop() {
  _clawdock_compose down
}

clawdock-restart() {
  _clawdock_compose restart propai-gateway
}

clawdock-logs() {
  _clawdock_compose logs -f propai-gateway
}

clawdock-status() {
  _clawdock_compose ps
}

# Navigation
clawdock-cd() {
  _clawdock_ensure_dir || return 1
  cd "${CLAWDOCK_DIR}"
}

clawdock-config() {
  cd ~/.propai
}

clawdock-workspace() {
  cd ~/.propai/workspace
}

# Container Access
clawdock-shell() {
  _clawdock_compose exec propai-gateway bash
}

clawdock-exec() {
  _clawdock_compose exec propai-gateway "$@"
}

# Maintenance
clawdock-rebuild() {
  _clawdock_compose build propai-gateway
}

clawdock-clean() {
  _clawdock_compose down -v --remove-orphans
}

# Health check
clawdock-health() {
  _clawdock_ensure_dir || return 1
  local token
  token=$(_clawdock_read_env_token)
  if [[ -z "$token" ]]; then
    echo "❌ Error: Could not find gateway token"
    echo "   Check: ${CLAWDOCK_DIR}/.env"
    return 1
  fi
  _clawdock_compose exec -e "PROPAI_GATEWAY_TOKEN=$token" propai-gateway \
    curl -fsS "http://127.0.0.1:18789/healthz" >/dev/null
}

# Show gateway token
clawdock-token() {
  _clawdock_read_env_token
}

# Fix token configuration (run this once after setup)
clawdock-fix-token() {
  _clawdock_ensure_dir || return 1

  echo "🔧 Configuring gateway token..."
  local token
  token=$(clawdock-token)
  if [[ -z "$token" ]]; then
    echo "❌ Error: Could not find gateway token"
    echo "   Check: ${CLAWDOCK_DIR}/.env"
    return 1
  fi

  echo "📝 Setting token: ${token:0:20}..."

  _clawdock_compose exec -e "TOKEN=$token" propai-gateway node - <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const token = process.env.TOKEN;
const home = process.env.HOME || "/home/node";
const configPath = path.join(home, ".propai", "propai.json");
let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch {
  cfg = {};
}
cfg.gateway ??= {};
cfg.gateway.remote ??= {};
cfg.gateway.auth ??= {};
cfg.gateway.remote.token = token;
cfg.gateway.auth.token = token;
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`);
NODE

  echo "🔍 Verifying token was saved..."
  local saved_token
  saved_token=$(_clawdock_compose exec propai-gateway node - <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const home = process.env.HOME || "/home/node";
const configPath = path.join(home, ".propai", "propai.json");
try {
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const token = cfg?.gateway?.remote?.token;
  if (typeof token === "string") {
    process.stdout.write(token.trim());
  }
} catch {
  // Ignore read errors.
}
NODE
 2>&1 | _clawdock_filter_warnings | tr -d '\r\n' | head -c 64)

  if [[ "$saved_token" == "$token" ]]; then
    echo "✅ Token saved correctly!"
  else
    echo "⚠️  Token mismatch detected"
    echo "   Expected: ${token:0:20}..."
    echo "   Got: ${saved_token:0:20}..."
  fi

  echo "🔄 Restarting gateway..."
  _clawdock_compose restart propai-gateway 2>&1 | _clawdock_filter_warnings

  echo "⏳ Waiting for gateway to start..."
  sleep 5

  echo "✅ Configuration complete!"
  echo -e "   Next: $(_cmd clawdock-dashboard)"
}

# Open dashboard in browser
clawdock-dashboard() {
  _clawdock_ensure_dir || return 1

  local token
  token=$(_clawdock_read_env_token)
  if [[ -z "$token" ]]; then
    echo "❌ Error: Could not find gateway token"
    echo "   Check: ${CLAWDOCK_DIR}/.env"
    return 1
  fi

  local port url
  port="${PROPAI_GATEWAY_PORT:-18789}"
  url="http://127.0.0.1:${port}"
  echo "✅ Opening: $url"
  open "$url" 2>/dev/null || xdg-open "$url" 2>/dev/null || echo "   Please open manually: $url"
  echo ""
  echo -e "${_CLR_CYAN}💡 Paste the token in Control UI settings:${_CLR_RESET} ${token:0:12}…"
}

# Show all available clawdock helper commands
clawdock-help() {
  echo -e "\n${_CLR_BOLD}${_CLR_CYAN}🦞 ClawDock - Docker Helpers for PropAi Sync${_CLR_RESET}\n"

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}⚡ Basic Operations${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-start)       ${_CLR_DIM}Start the gateway${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-stop)        ${_CLR_DIM}Stop the gateway${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-restart)     ${_CLR_DIM}Restart the gateway${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-status)      ${_CLR_DIM}Check container status${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-logs)        ${_CLR_DIM}View live logs (follows)${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}🐚 Container Access${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-shell)       ${_CLR_DIM}Shell into container${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-exec) ${_CLR_CYAN}<cmd>${_CLR_RESET}  ${_CLR_DIM}Execute command in gateway container${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}🌐 Web UI${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-dashboard)   ${_CLR_DIM}Open web UI in browser${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}⚙️  Setup & Configuration${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-fix-token)   ${_CLR_DIM}Configure gateway token ${_CLR_CYAN}(run once)${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}🔧 Maintenance${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-rebuild)     ${_CLR_DIM}Rebuild Docker image${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-clean)       ${_CLR_RED}⚠️  Remove containers & volumes (nuclear)${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_MAGENTA}🛠️  Utilities${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-health)      ${_CLR_DIM}Run health check${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-token)       ${_CLR_DIM}Show gateway auth token${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-cd)          ${_CLR_DIM}Jump to PropAi Sync project directory${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-config)      ${_CLR_DIM}Open config directory (~/.propai)${_CLR_RESET}"
  echo -e "  $(_cmd clawdock-workspace)   ${_CLR_DIM}Open workspace directory${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${_CLR_RESET}"
  echo -e "${_CLR_BOLD}${_CLR_GREEN}🚀 First Time Setup${_CLR_RESET}"
  echo -e "${_CLR_CYAN}  1.${_CLR_RESET} $(_cmd clawdock-start)          ${_CLR_DIM}# Start the gateway${_CLR_RESET}"
  echo -e "${_CLR_CYAN}  2.${_CLR_RESET} $(_cmd clawdock-fix-token)      ${_CLR_DIM}# Configure token${_CLR_RESET}"
  echo -e "${_CLR_CYAN}  3.${_CLR_RESET} $(_cmd clawdock-dashboard)      ${_CLR_DIM}# Open web UI${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_GREEN}💬 WhatsApp Setup${_CLR_RESET}"
  echo -e "  Open the Control UI and link WhatsApp from Channels."
  echo ""

  echo -e "${_CLR_BOLD}${_CLR_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${_CLR_RESET}"
  echo ""

  echo -e "${_CLR_CYAN}💡 All commands guide you through next steps!${_CLR_RESET}"
  echo -e "${_CLR_BLUE}📚 Docs: ${_CLR_RESET}${_CLR_CYAN}https://docs.propai.ai${_CLR_RESET}"
  echo ""
}






