#!/usr/bin/env bash
set -euo pipefail

# Build and package the Claude Desktop Extension (.mcpb)
# Usage: ./scripts/pack-extension.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STAGING_DIR="$PROJECT_DIR/.mcpb-staging"

echo "==> Building project..."
cd "$PROJECT_DIR"
npm run build

echo "==> Creating staging directory..."
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# Copy only what the extension needs
cp "$PROJECT_DIR/manifest.json" "$STAGING_DIR/"
cp "$PROJECT_DIR/package.json" "$STAGING_DIR/"
cp -R "$PROJECT_DIR/dist" "$STAGING_DIR/"
cp -R "$PROJECT_DIR/assets" "$STAGING_DIR/"

# Install production-only dependencies
echo "==> Installing production dependencies..."
cd "$STAGING_DIR"
npm install --omit=dev --ignore-scripts 2>&1 | tail -1

# Pack the extension
echo "==> Packing .mcpb extension..."
npx @anthropic-ai/mcpb pack "$STAGING_DIR" "$PROJECT_DIR"

# Clean up
echo "==> Cleaning up staging directory..."
rm -rf "$STAGING_DIR"

echo ""
echo "==> Done! Extension file:"
ls -lh "$PROJECT_DIR"/*.mcpb
