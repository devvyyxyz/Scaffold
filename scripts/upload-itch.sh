#!/usr/bin/env bash
#
# Upload Scaffold build artifacts to itch.io via butler.
#
# Prerequisites:
#   1. Install butler:  brew install butler   (macOS)
#                       or https://itch.io/docs/butler/installing.html
#   2. Authenticate:    butler login
#   3. Create the game page on itch.io first (set name, etc.)
#
# Environment variables:
#   ITCH_USER   – your itch.io username  (e.g. "myuser")
#   ITCH_GAME   – the game slug          (e.g. "scaffold")
#
# Usage:
#   bash scripts/upload-itch.sh mac        # upload macOS build
#   bash scripts/upload-itch.sh linux      # upload Linux build
#   bash scripts/upload-itch.sh windows    # upload Windows build
#   bash scripts/upload-itch.sh all        # upload all platforms
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ITCH_USER="${ITCH_USER:-Devvyyxyz}"
ITCH_GAME="${ITCH_GAME:-scaffold}"
VERSION="${VERSION:-$(node -p "require('./package.json').version")}"
BUNDLE_DIR="src-tauri/target/release/bundle"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log()  { printf "\033[1;34m▸ %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m✖ %s\033[0m\n" "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || err "Missing required command: $1. Install it first."
}

# Push a single file (or directory) to an itch.io channel.
# Usage: push <file_or_dir> <channel>
push() {
  local src="$1" channel="$2"
  if [ ! -e "$src" ]; then
    err "Artifact not found: $src"
  fi
  log "Pushing $src → ${ITCH_USER}/${ITCH_GAME}:${channel} (v${VERSION})"
  butler push --userversion "$VERSION" "$src" "${ITCH_USER}/${ITCH_GAME}:${channel}"
}

# ---------------------------------------------------------------------------
# Platform uploaders
# ---------------------------------------------------------------------------

upload_mac() {
  log "Uploading macOS build…"
  # Try .dmg first, fall back to .app
  local dmg
  dmg=$(ls "$BUNDLE_DIR/dmg/"*.dmg 2>/dev/null | head -1)
  if [ -n "$dmg" ]; then
    push "$dmg" "mac"
    return
  fi
  local app
  app=$(ls -d "$BUNDLE_DIR/macos/"*.app 2>/dev/null | head -1)
  if [ -n "$app" ]; then
    push "$app" "mac"
    return
  fi
  err "No macOS artifact found in $BUNDLE_DIR/dmg/ or $BUNDLE_DIR/macos/. Run 'tauri build' first."
}

upload_linux() {
  log "Uploading Linux build…"
  # Try AppImage first, fall back to .deb
  local appimage
  appimage=$(ls "$BUNDLE_DIR/appimage/"*.AppImage 2>/dev/null | head -1)
  if [ -n "$appimage" ]; then
    push "$appimage" "linux"
    return
  fi
  local deb
  deb=$(ls "$BUNDLE_DIR/deb/"*.deb 2>/dev/null | head -1)
  if [ -n "$deb" ]; then
    push "$deb" "linux"
    return
  fi
  err "No Linux artifact found in $BUNDLE_DIR/appimage/ or $BUNDLE_DIR/deb/. Run 'tauri build' first."
}

upload_windows() {
  log "Uploading Windows build…"
  # Try NSIS .exe first, fall back to .msi
  local exe
  exe=$(ls "$BUNDLE_DIR/nsis/"*.exe 2>/dev/null | head -1)
  if [ -n "$exe" ]; then
    push "$exe" "windows"
    return
  fi
  local msi
  msi=$(ls "$BUNDLE_DIR/msi/"*.msi 2>/dev/null | head -1)
  if [ -n "$msi" ]; then
    push "$msi" "windows"
    return
  fi
  err "No Windows artifact found in $BUNDLE_DIR/nsis/ or $BUNDLE_DIR/msi/. Run 'tauri build' first."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

require_cmd butler
require_cmd node

PLATFORM="${1:-}"
case "$PLATFORM" in
  mac)     upload_mac ;;
  linux)   upload_linux ;;
  windows) upload_windows ;;
  all)
    # Upload whichever artifacts are present
    upload_mac || true
    upload_linux || true
    upload_windows || true
    ;;
  *)
    echo "Usage: $0 <mac|linux|windows|all>"
    echo ""
    echo "Environment variables:"
    echo "  ITCH_USER   itch.io username"
    echo "  ITCH_GAME   game slug on itch.io"
    echo "  VERSION     override version (default: from package.json)"
    exit 1
    ;;
esac

log "Done! ✓"