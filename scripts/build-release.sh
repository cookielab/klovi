#!/usr/bin/env bash
set -euo pipefail

# Local release build script — mirrors .github/workflows/release.yml macOS steps
# Usage: ./scripts/build-release.sh <version>
# Example: ./scripts/build-release.sh 3.0.0-beta.8

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Validate version argument ---
VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>"
  echo "  version: X.Y.Z or X.Y.Z-(beta|rc).N"
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-(beta|rc)\.[0-9]+)?$ ]]; then
  echo "Error: Invalid version format '$VERSION'"
  echo "  Expected: X.Y.Z or X.Y.Z-(beta|rc).N"
  exit 1
fi

# --- Load signing credentials ---
ENV_FILE="$SCRIPT_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found"
  echo "Create it with:"
  echo "  APPLE_TEAM_ID=..."
  echo "  APPLE_ID=..."
  echo "  APPLE_APP_PASSWORD=..."
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

for var in APPLE_TEAM_ID APPLE_ID APPLE_APP_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set in $ENV_FILE"
    exit 1
  fi
done

IDENTITY="Developer ID Application: Cookielab s.r.o. ($APPLE_TEAM_ID)"

# --- Restore package.json on exit ---
cleanup() {
  echo ""
  echo "Restoring package.json..."
  git -C "$PROJECT_DIR" checkout package.json
}
trap cleanup EXIT

# --- Set version in package.json ---
echo "Setting version to $VERSION in package.json..."
cd "$PROJECT_DIR"
bun -e "
  const pkg = await Bun.file('package.json').json();
  pkg.version = process.env.VERSION;
  await Bun.write('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# --- Build ---
echo ""
echo "Building stable release..."
bun run build -- --env=stable

# --- Sign ---
BUILD_DIR="build/stable-macos-arm64"
APP_DIR=$(find "$BUILD_DIR" -maxdepth 1 -type d -name "*.app" | head -1)

if [[ -z "$APP_DIR" ]]; then
  echo "Error: No .app bundle found in $BUILD_DIR"
  exit 1
fi

echo ""
echo "Signing $APP_DIR..."

echo "  Signing dylibs and shared objects..."
find "$APP_DIR" -type f \( -name "*.dylib" -o -name "*.so" \) -exec \
  codesign --force --options runtime --sign "$IDENTITY" {} \;

echo "  Signing frameworks..."
find "$APP_DIR" -type d -name "*.framework" -exec \
  codesign --force --options runtime --sign "$IDENTITY" {} \;

echo "  Signing executables..."
find "$APP_DIR/Contents/MacOS" -type f -perm +111 -exec \
  codesign --force --options runtime --sign "$IDENTITY" {} \;

echo "  Signing app bundle..."
codesign --force --options runtime --sign "$IDENTITY" "$APP_DIR"

echo "  Verifying signature..."
codesign --verify --deep --strict "$APP_DIR"
echo "  Signature OK"

# --- Notarize ---
echo ""
echo "Submitting for notarization (this may take a few minutes)..."
NOTARIZE_ZIP=$(mktemp /tmp/notarize.XXXXXX.zip)

ditto -c -k --keepParent "$APP_DIR" "$NOTARIZE_ZIP"

xcrun notarytool submit "$NOTARIZE_ZIP" \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_PASSWORD" \
  --wait

rm "$NOTARIZE_ZIP"

echo "Stapling notarization ticket..."
xcrun stapler staple "$APP_DIR"

# --- Package ---
ZIP_NAME="Klovi-${VERSION}-macos-arm64.zip"
echo ""
echo "Packaging $ZIP_NAME..."
ditto -c -k --keepParent "$APP_DIR" "$ZIP_NAME"

# --- Summary ---
ZIP_SIZE=$(du -h "$ZIP_NAME" | cut -f1)
echo ""
echo "=== Build complete ==="
echo "  App:     $APP_DIR"
echo "  ZIP:     $ZIP_NAME ($ZIP_SIZE)"
echo "  Version: $VERSION"
