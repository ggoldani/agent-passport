#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# AgentPassport — one-command setup for hackathon judges
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# What it does:
#   1. Checks prerequisites (Node.js ≥ 20)
#   2. Clones and builds stellar-mcp companion service
#   3. Installs agent-passport + dashboard dependencies
#   4. Creates .env from .env.demo if missing
#   5. Starts stellar-mcp, provider, and dashboard in background
#   6. Runs health checks on all services
#   7. Prints URLs and next steps
#
# Press Ctrl+C to stop all background services.
###############################################################################

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m';    NC='\033[0m'

info()  { echo -e "${BLUE}  →${NC} $1"; }
ok()    { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  !${NC} $1"; }
err()   { echo -e "${RED}  ✗${NC} $1"; }
step()  { echo -e "\n${BOLD}${BLUE}[$1]${NC}"; }

# ── Config ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="${SCRIPT_DIR}/../stellar-mcp"
MCP_REPO="https://github.com/ggoldani/stellar-mcp.git"
MCP_PORT=3005
PROVIDER_PORT=3001
API_PORT=3002
DASHBOARD_PORT=3000

MCP_LOG="/tmp/ap-stellar-mcp.log"
PROVIDER_LOG="/tmp/ap-provider.log"
API_LOG="/tmp/ap-api.log"
DASHBOARD_LOG="/tmp/ap-dashboard.log"

MCP_PID=""
PROVIDER_PID=""
API_PID=""
DASHBOARD_PID=""

# ── Cleanup ─────────────────────────────────────────────────────────────────
cleanup() {
    echo ""
    info "Stopping services..."
    # Graceful kill by PID
    [ -n "${DASHBOARD_PID:-}" ]  && kill "$DASHBOARD_PID"  2>/dev/null
    [ -n "${API_PID:-}" ]       && kill "$API_PID"       2>/dev/null
    [ -n "${PROVIDER_PID:-}" ]   && kill "$PROVIDER_PID"   2>/dev/null
    [ -n "${MCP_PID:-}" ]        && kill "$MCP_PID"        2>/dev/null
    sleep 1
    # Kill anything still on our ports (catches Next.js child workers)
    for port in $MCP_PORT $PROVIDER_PORT $API_PORT $DASHBOARD_PORT; do
        pids=$(lsof -ti :"$port" 2>/dev/null || true)
        [ -n "$pids" ] && kill $pids 2>/dev/null
    done
    sleep 1
    # Final: force kill any survivors
    for port in $MCP_PORT $PROVIDER_PORT $API_PORT $DASHBOARD_PORT; do
        pids=$(lsof -ti :"$port" 2>/dev/null || true)
        [ -n "$pids" ] && kill -9 $pids 2>/dev/null
    done
    ok "All services stopped"
    echo ""
    exit 0
}
trap cleanup SIGINT SIGTERM

# ── Banner ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  ╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}  ║   AgentPassport — Hackathon Setup    ║${NC}"
echo -e "${BOLD}  ╚══════════════════════════════════════╝${NC}"
echo ""

# ── 1. Prerequisites ───────────────────────────────────────────────────────
step "1/6 Prerequisites"

command -v node >/dev/null 2>&1 || { err "Node.js ≥ 20 is required. Install: https://nodejs.org"; exit 1; }
command -v npm >/dev/null 2>&1  || { err "npm is required."; exit 1; }
command -v git >/dev/null 2>&1  || { err "git is required."; exit 1; }

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    err "Node.js ≥ 20 required. Found: $(node -v)"
    exit 1
fi
ok "Node.js $(node -v)"
ok "npm $(npm -v)"
ok "git $(git --version | cut -d' ' -f3)"

# ── 2. Environment ─────────────────────────────────────────────────────────
step "2/6 Environment (.env)"

if [ -f "${SCRIPT_DIR}/.env" ]; then
    ok ".env exists (skipping)"
else
    if [ -f "${SCRIPT_DIR}/.env.demo" ]; then
        cp "${SCRIPT_DIR}/.env.demo" "${SCRIPT_DIR}/.env"
        ok "Created .env from .env.demo"
    elif [ -f "${SCRIPT_DIR}/.env.example" ]; then
        cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"
        ok "Created .env from .env.example"
    else
        err "No .env template found (.env.demo or .env.example)"
        exit 1
    fi
fi

# Check for secrets
if grep -qP '^RELAYER_SECRET_KEY=""$' "${SCRIPT_DIR}/.env" 2>/dev/null; then
    echo ""
    warn "RELAYER_SECRET_KEY is empty."
    warn "PROVIDER_OWNER_SECRET_KEY is empty."
    echo ""
    warn "The dashboard will work in read-only mode."
    warn "Fill in both keys for the full end-to-end demo (payment + rating)."
    warn "Generate funded testnet accounts at:"
    warn "  https://laboratory.stellar.org/#account-creator?network=test"
    echo ""
    read -rp "Press Enter to continue in read-only mode, or Ctrl+C to configure .env first..."
fi

# Load env vars for child processes
set -a
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/.env"
set +a

# ── 3. stellar-mcp ─────────────────────────────────────────────────────────
step "3/6 Companion service (stellar-mcp)"

if [ -d "${MCP_DIR}" ]; then
    ok "stellar-mcp directory exists"
else
    info "Cloning stellar-mcp..."
    git clone --depth 1 "$MCP_REPO" "${MCP_DIR}"
    ok "stellar-mcp cloned"
fi

if [ ! -d "${MCP_DIR}/node_modules" ]; then
    info "Installing stellar-mcp dependencies..."
    (cd "${MCP_DIR}" && npm install --silent 2>&1)
    ok "stellar-mcp dependencies installed"
else
    ok "stellar-mcp dependencies present"
fi

if [ ! -d "${MCP_DIR}/build" ]; then
    info "Building stellar-mcp..."
    (cd "${MCP_DIR}" && npm run build 2>&1)
    ok "stellar-mcp built"
else
    ok "stellar-mcp already built"
fi

# ── 4. agent-passport dependencies ─────────────────────────────────────────
step "4/6 agent-passport dependencies"

if [ ! -d "${SCRIPT_DIR}/node_modules" ]; then
    info "Installing root dependencies..."
    (cd "${SCRIPT_DIR}" && npm install --silent 2>&1)
    ok "Root dependencies installed"
else
    ok "Root dependencies present"
fi

if [ ! -d "${SCRIPT_DIR}/web/node_modules" ]; then
    info "Installing dashboard dependencies..."
    (cd "${SCRIPT_DIR}/web" && npm install --silent 2>&1)
    ok "Dashboard dependencies installed"
else
    ok "Dashboard dependencies present"
fi

# ── 5. Start services ──────────────────────────────────────────────────────
step "5/6 Starting services"

# Kill stale processes on our ports
for port in $MCP_PORT $PROVIDER_PORT $API_PORT $DASHBOARD_PORT; do
    stale=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$stale" ]; then
        warn "Port ${port} is in use — killing stale process(es)"
        # shellcheck disable=SC2086
        kill $stale 2>/dev/null || true
        sleep 1
    fi
done

# stellar-mcp
info "Starting stellar-mcp on port ${MCP_PORT}..."
(cd "${MCP_DIR}" && \
    MCP_TRANSPORT=http-sse PORT=${MCP_PORT} STELLAR_NETWORK=testnet \
    node build/src/index.js > "$MCP_LOG" 2>&1) &
MCP_PID=$!

# Provider
info "Starting provider on port ${PROVIDER_PORT}..."
(cd "${SCRIPT_DIR}" && npx tsx src/provider/server.ts > "$PROVIDER_LOG" 2>&1) &
PROVIDER_PID=$!

# API server
info "Starting API server on port ${API_PORT}..."
(cd "${SCRIPT_DIR}" && npx tsx scripts/run-api.ts > "$API_LOG" 2>&1) &
API_PID=$!

# Dashboard
info "Starting dashboard on port ${DASHBOARD_PORT}..."
(cd "${SCRIPT_DIR}/web" && npx next dev --port "$DASHBOARD_PORT" > "$DASHBOARD_LOG" 2>&1) &
DASHBOARD_PID=$!

# Wait for services
echo ""
info "Waiting for services to start..."

# stellar-mcp health
for i in $(seq 1 15); do
    if curl -sf "http://127.0.0.1:${MCP_PORT}/health" >/dev/null 2>&1; then
        ok "stellar-mcp (port ${MCP_PORT})"
        break
    fi
    [ "$i" -eq 15 ] && { err "stellar-mcp did not start. Check ${MCP_LOG}"; }
    sleep 1
done

# Provider health
for i in $(seq 1 15); do
    if curl -sf "http://127.0.0.1:${PROVIDER_PORT}/health" >/dev/null 2>&1; then
        ok "Provider (port ${PROVIDER_PORT})"
        break
    fi
    [ "$i" -eq 15 ] && { err "Provider did not start. Check ${PROVIDER_LOG}"; }
    sleep 1
done

# API health
for i in $(seq 1 15); do
    if curl -sf "http://127.0.0.1:${API_PORT}/" >/dev/null 2>&1; then
        ok "API server (port ${API_PORT})"
        break
    fi
    [ "$i" -eq 15 ] && { err "API server did not start. Check ${API_LOG}"; }
    sleep 1
done

# Dashboard (Next.js takes longer)
for i in $(seq 1 25); do
    if curl -sf "http://127.0.0.1:${DASHBOARD_PORT}" >/dev/null 2>&1; then
        ok "Dashboard (port ${DASHBOARD_PORT})"
        break
    fi
    [ "$i" -eq 25 ] && warn "Dashboard still starting... give it a few more seconds"
    sleep 1
done

# ── 6. Done ────────────────────────────────────────────────────────────────
step "6/6 Ready"

DEMO_PROVIDER="GC7TRXR2SJ7644453S5BR755L5M2OSUFIFOEAYGEPMUOKLPFI6HEKOPT"

echo ""
echo -e "${GREEN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}    AgentPassport is running!${NC}"
echo -e "${GREEN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Dashboard (leaderboard):"
echo "    http://localhost:${DASHBOARD_PORT}"
echo ""
echo "  Provider trust profile:"
echo "    http://localhost:${DASHBOARD_PORT}/agents/${DEMO_PROVIDER}"
echo ""
echo "  Analytics charts:"
echo "    http://localhost:${DASHBOARD_PORT}/agents/${DEMO_PROVIDER}/analytics"
echo ""
echo "  Services:"
echo "    stellar-mcp   → http://localhost:${MCP_PORT}"
echo "    provider      → http://localhost:${PROVIDER_PORT}"
echo "    api           → http://localhost:${API_PORT}"
echo "    dashboard     → http://localhost:${DASHBOARD_PORT}"
echo ""
echo "  Run the full demo:"
echo "    cd ${SCRIPT_DIR} && npm run demo"
echo ""
echo "  Logs:"
echo "    stellar-mcp  → ${MCP_LOG}"
echo "    provider     → ${PROVIDER_LOG}"
echo "    api          → ${API_LOG}"
echo "    dashboard    → ${DASHBOARD_LOG}"
echo ""
echo "  Press ${BOLD}Ctrl+C${NC} to stop all services."
echo ""

# Keep alive until Ctrl+C
wait
