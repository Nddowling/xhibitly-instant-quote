#!/usr/bin/env bash
#
# Setup script for "Claude in Chrome" browser extension integration with Claude Code.
#
# This script:
#   1. Verifies Claude Code CLI is installed (>= 2.0.73)
#   2. Creates the Native Messaging Host configuration for Chrome/Edge
#   3. Provides instructions for installing the Chrome Web Store extension
#
# Usage:
#   chmod +x scripts/setup-chrome-extension.sh
#   ./scripts/setup-chrome-extension.sh
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*"; }

# ---------------------------------------------------------------------------
# 1. Check Claude Code CLI
# ---------------------------------------------------------------------------
info "Checking Claude Code CLI installation..."

if ! command -v claude &>/dev/null; then
  error "Claude Code CLI is not installed."
  echo ""
  echo "  Install it with:  npm install -g @anthropic-ai/claude-code"
  echo ""
  exit 1
fi

CLAUDE_VERSION=$(claude --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "0.0.0")
REQUIRED_VERSION="2.0.73"

version_gte() {
  printf '%s\n%s' "$2" "$1" | sort -V -C
}

if version_gte "$CLAUDE_VERSION" "$REQUIRED_VERSION"; then
  success "Claude Code CLI v${CLAUDE_VERSION} (>= ${REQUIRED_VERSION} required)"
else
  error "Claude Code CLI v${CLAUDE_VERSION} is too old. Version >= ${REQUIRED_VERSION} is required."
  echo ""
  echo "  Update with:  npm install -g @anthropic-ai/claude-code@latest"
  echo ""
  exit 1
fi

CLAUDE_BIN=$(command -v claude)
success "Claude Code binary: ${CLAUDE_BIN}"

# ---------------------------------------------------------------------------
# 2. Detect OS and set paths
# ---------------------------------------------------------------------------
info "Detecting operating system..."

OS="$(uname -s)"
case "$OS" in
  Darwin)
    CHROME_NMH_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    EDGE_NMH_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
    success "macOS detected"
    ;;
  Linux)
    CHROME_NMH_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    EDGE_NMH_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
    success "Linux detected"
    ;;
  *)
    error "Unsupported OS: ${OS}"
    echo "  Windows users: please follow the manual setup instructions in CHROME_EXTENSION_SETUP.md"
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# 3. Create Native Messaging Host configuration
# ---------------------------------------------------------------------------
NMH_NAME="com.anthropic.claude_code_browser_extension"
NMH_FILE="${NMH_NAME}.json"

setup_nmh() {
  local dir="$1"
  local browser="$2"

  info "Setting up Native Messaging Host for ${browser}..."

  mkdir -p "$dir"

  cat > "${dir}/${NMH_FILE}" <<EOF
{
  "name": "${NMH_NAME}",
  "description": "Claude Code Browser Extension Native Messaging Host",
  "path": "${CLAUDE_BIN}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://fcoeoabgfenejglbffodgkkbkcdhcgfn/"
  ]
}
EOF

  success "${browser} Native Messaging Host config written to:"
  echo "         ${dir}/${NMH_FILE}"
}

# Ask which browsers to configure
CONFIGURED=false

if [ -d "$(dirname "$CHROME_NMH_DIR")" ] || [ "$OS" = "Darwin" ]; then
  setup_nmh "$CHROME_NMH_DIR" "Chrome"
  CONFIGURED=true
else
  warn "Chrome config directory not found — skipping Chrome setup."
fi

if [ -d "$(dirname "$EDGE_NMH_DIR")" ]; then
  setup_nmh "$EDGE_NMH_DIR" "Edge"
  CONFIGURED=true
else
  info "Edge config directory not found — skipping Edge setup."
fi

if [ "$CONFIGURED" = false ]; then
  warn "No supported browser config directories found."
  echo "  Creating Chrome config directory and proceeding..."
  setup_nmh "$CHROME_NMH_DIR" "Chrome"
fi

# ---------------------------------------------------------------------------
# 4. Print next steps
# ---------------------------------------------------------------------------
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
info "Next steps to complete the installation:"
echo ""
echo "  1. Install the Chrome extension from the Chrome Web Store:"
echo "     https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn"
echo ""
echo "  2. Pin the extension (click the puzzle piece icon in Chrome toolbar)"
echo ""
echo "  3. Sign in with your Anthropic account (Pro, Max, Team, or Enterprise)"
echo ""
echo "  4. Launch Claude Code with Chrome integration:"
echo "     ${GREEN}claude --chrome${NC}"
echo ""
echo "  5. Or from an existing Claude Code session, run:"
echo "     ${GREEN}/chrome${NC}"
echo ""
echo "  6. To enable Chrome by default, run /chrome and select 'Enabled by default'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
success "Setup complete!"
