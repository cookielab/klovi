#!/usr/bin/env bash
set -euo pipefail

# Local release build script — mirrors .github/workflows/release.yml macOS steps
# Usage: ./scripts/build-release.sh <version>
# Example: ./scripts/build-release.sh 3.0.0-beta.8

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$PROJECT_DIR/apps/desktop"
APP_PACKAGE_PATH="apps/desktop/package.json"
APP_PACKAGE_JSON="$APP_DIR/package.json"

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
  echo "  APPLE_CERTIFICATE=<base64-encoded .p12>"
  echo "  APPLE_CERTIFICATE_PASSWORD=..."
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

for var in APPLE_TEAM_ID APPLE_ID APPLE_APP_PASSWORD APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set in $ENV_FILE"
    exit 1
  fi
done

IDENTITY="Developer ID Application: Cookielab s.r.o. ($APPLE_TEAM_ID)"

# --- Import certificate into temporary keychain ---
echo "Importing signing certificate..."
CERT_FILE=$(mktemp /tmp/certificate.XXXXXX.p12)
KEYCHAIN_FILE=$(mktemp /tmp/keychain.XXXXXX)
rm -f "$KEYCHAIN_FILE"
KEYCHAIN_FILE="${KEYCHAIN_FILE}.keychain-db"
KEYCHAIN_PASSWORD=$(openssl rand -base64 32)

echo "$APPLE_CERTIFICATE" | base64 --decode > "$CERT_FILE"

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_FILE"
security set-keychain-settings -lut 21600 "$KEYCHAIN_FILE"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_FILE"
security import "$CERT_FILE" -P "$APPLE_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_FILE"
security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_FILE"
security list-keychains -d user -s "$KEYCHAIN_FILE" login.keychain

rm "$CERT_FILE"
echo "  Certificate imported into temporary keychain"

# --- Cleanup on exit ---
cleanup() {
  echo ""
  echo "Restoring package.json..."
  git -C "$PROJECT_DIR" checkout "$APP_PACKAGE_PATH"
  echo "Removing temporary keychain..."
  security delete-keychain "$KEYCHAIN_FILE" 2>/dev/null || true
}
trap cleanup EXIT

# --- Set version and commit in package.json ---
COMMIT=$(git rev-parse --short HEAD)
echo "Setting version to $VERSION and commit to $COMMIT in package.json..."
cd "$PROJECT_DIR"
VERSION="$VERSION" COMMIT="$COMMIT" APP_PACKAGE_JSON="$APP_PACKAGE_JSON" bun -e "
  const pkg = await Bun.file(process.env.APP_PACKAGE_JSON).json();
  pkg.version = process.env.VERSION;
  pkg.commit = process.env.COMMIT;
  await Bun.write(process.env.APP_PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n');
"

# --- Build ---
echo ""
echo "Building stable release..."
bun run build -- --env=stable

# --- Sign ---
BUILD_DIR="apps/desktop/build/stable-macos-arm64"
APP_BUNDLE_DIR=$(find "$BUILD_DIR" -maxdepth 1 -type d -name "*.app" | head -1)

if [[ -z "$APP_BUNDLE_DIR" ]]; then
  echo "Error: No .app bundle found in $BUILD_DIR"
  exit 1
fi

echo ""
echo "Signing $APP_BUNDLE_DIR..."

echo "  Signing dylibs and shared objects..."
find "$APP_BUNDLE_DIR" -type f \( -name "*.dylib" -o -name "*.so" \) -exec \
  codesign --force --options runtime --sign "$IDENTITY" --keychain "$KEYCHAIN_FILE" {} \;

echo "  Signing frameworks..."
find "$APP_BUNDLE_DIR" -type d -name "*.framework" -exec \
  codesign --force --options runtime --sign "$IDENTITY" --keychain "$KEYCHAIN_FILE" {} \;

echo "  Signing executables..."
find "$APP_BUNDLE_DIR/Contents/MacOS" -type f -perm +111 -exec \
  codesign --force --options runtime --sign "$IDENTITY" --keychain "$KEYCHAIN_FILE" {} \;

echo "  Signing app bundle..."
codesign --force --options runtime --sign "$IDENTITY" --keychain "$KEYCHAIN_FILE" "$APP_BUNDLE_DIR"

echo "  Verifying signature..."
codesign --verify --deep --strict "$APP_BUNDLE_DIR"
echo "  Signature OK"

# --- Notarize ---
echo ""
echo "Submitting for notarization (this may take a few minutes)..."
NOTARIZE_ZIP=$(mktemp /tmp/notarize.XXXXXX.zip)

ditto -c -k --keepParent "$APP_BUNDLE_DIR" "$NOTARIZE_ZIP"

xcrun notarytool submit "$NOTARIZE_ZIP" \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_PASSWORD" \
  --wait

rm "$NOTARIZE_ZIP"

echo "Stapling notarization ticket..."
xcrun stapler staple "$APP_BUNDLE_DIR"

# --- Package ---
ZIP_NAME="apps/desktop/build/Klovi-${VERSION}-macos-arm64.zip"
echo ""
echo "Packaging $ZIP_NAME..."
ditto -c -k --keepParent "$APP_BUNDLE_DIR" "$ZIP_NAME"

# --- Summary ---
ZIP_SIZE=$(du -h "$ZIP_NAME" | cut -f1)
echo ""
echo "=== Build complete ==="
echo "  App:     $APP_BUNDLE_DIR"
echo "  ZIP:     $ZIP_NAME ($ZIP_SIZE)"
echo "  Version: $VERSION"
