#!/usr/bin/env bash
set -euo pipefail

# Local release build script — mirrors .github/workflows/release-desktop.yml macOS steps
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

BUILD_ENV="stable"
if [[ "$VERSION" == *-beta.* ]]; then
  BUILD_ENV="beta"
elif [[ "$VERSION" == *-rc.* ]]; then
  BUILD_ENV="candidate"
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
echo "Syncing Bun dependencies and patching Electrobun macOS runtime..."
cd "$PROJECT_DIR"
bun install --frozen-lockfile

ELECTROBUN_PACKAGE_DIR="$PROJECT_DIR/node_modules/electrobun"
if [[ ! -d "$ELECTROBUN_PACKAGE_DIR" ]]; then
  echo "Error: Electrobun install not found at $ELECTROBUN_PACKAGE_DIR"
  exit 1
fi

ELECTROBUN_PACKAGE_DIR="$ELECTROBUN_PACKAGE_DIR" bun -e '
  const root = process.env.ELECTROBUN_PACKAGE_DIR;
  if (!root) throw new Error("ELECTROBUN_PACKAGE_DIR is not set");

  const patchFile = async (relativePath: string, transform: (text: string) => string) => {
    const path = `${root}/${relativePath}`;
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new Error(`Electrobun runtime file not found: ${path}`);
    }

    const before = await file.text();
    const after = transform(before);
    if (before !== after) {
      await Bun.write(path, after);
    }
  };

  await patchFile("dist-macos-arm64/main.js", (text) =>
    text.replaceAll("process.argv0", "process.execPath"),
  );

  await patchFile("dist-macos-arm64/api/bun/core/BuildConfig.ts", (text) => {
    let next = text;
    if (!next.includes(`import { join, dirname } from "path";`)) {
      next = next.replace(
        "export type BuildConfigType = {",
        `import { join, dirname } from "path";\n\nexport type BuildConfigType = {`,
      );
    }

    return next.replace(
      "Bun.file(`../${resourcesDir}/build.json`).json()",
      "Bun.file(join(dirname(process.execPath), \"..\", resourcesDir, \"build.json\")).json()",
    );
  });

  await patchFile("dist-macos-arm64/api/bun/core/Paths.ts", (text) => {
    let next = text;
    if (!next.includes(`import { resolve, dirname } from "path";`)) {
      next = next.replace(
        `import { resolve } from "path";`,
        `import { resolve, dirname } from "path";`,
      );
    }

    return next.replace(
      `const RESOURCES_FOLDER = resolve("../Resources/");`,
      `const RESOURCES_FOLDER = resolve(dirname(process.execPath), "../Resources/");`,
    );
  });

  await patchFile("dist-macos-arm64/api/bun/core/Updater.ts", (text) =>
    text.replace(
      "Bun.file(`../${resourcesDir}/version.json`).json()",
      "Bun.file(join(dirname(process.execPath), \"..\", resourcesDir, \"version.json\")).json()",
    ),
  );

  await patchFile("dist-macos-arm64/api/bun/core/Utils.ts", (text) => {
    let next = text;
    if (!next.includes(`import { join, dirname } from "node:path";`)) {
      next = next.replace(
        `import { join } from "node:path";`,
        `import { join, dirname } from "node:path";`,
      );
    }

    return next.replace(
      `readFileSync(join("..", resourcesDir, "version.json"), "utf-8")`,
      `readFileSync(join(dirname(process.execPath), "..", resourcesDir, "version.json"), "utf-8")`,
    );
  });

  await patchFile("dist-macos-arm64/api/bun/proc/native.ts", (text) => {
    let next = text;
    if (!next.includes(`import { join, dirname } from "path";`)) {
      next = next.replace(
        `import { join } from "path";`,
        `import { join, dirname } from "path";`,
      );
    }

    return next.replace(
      "join(process.cwd(), `libNativeWrapper.${suffix}`)",
      "join(dirname(process.execPath), `libNativeWrapper.${suffix}`)",
    );
  });
'

if ! rg -q 'process\\.execPath' "$ELECTROBUN_PACKAGE_DIR/dist-macos-arm64/main.js"; then
  echo "Error: Electrobun macOS runtime patch is missing in $ELECTROBUN_PACKAGE_DIR/dist-macos-arm64/main.js"
  echo "Expected process.execPath-based launcher paths for App Translocation safety"
  exit 1
fi

if ! rg -q 'dirname\\(process\\.execPath\\).*build\\.json' "$ELECTROBUN_PACKAGE_DIR/dist-macos-arm64/api/bun/core/BuildConfig.ts"; then
  echo "Error: Electrobun macOS runtime patch is missing in $ELECTROBUN_PACKAGE_DIR/dist-macos-arm64/api/bun/core/BuildConfig.ts"
  echo "Expected absolute build.json lookup for App Translocation safety"
  exit 1
fi

echo "Setting version to $VERSION and commit to $COMMIT in package.json..."
VERSION="$VERSION" COMMIT="$COMMIT" APP_PACKAGE_JSON="$APP_PACKAGE_JSON" bun -e "
  const pkg = await Bun.file(process.env.APP_PACKAGE_JSON).json();
  pkg.version = process.env.VERSION;
  pkg.commit = process.env.COMMIT;
  await Bun.write(process.env.APP_PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n');
"

# --- Build ---
echo ""
echo "Building $BUILD_ENV release..."
bun run build -- --env="$BUILD_ENV"

# --- Sign ---
BUILD_DIR="apps/desktop/build/${BUILD_ENV}-macos-arm64"
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
DMG_STAGING_DIR=$(mktemp -d /tmp/klovi-dmg.XXXXXX)
DMG_NAME="apps/desktop/build/Klovi-${VERSION}-macos-arm64.dmg"
echo ""
echo "Packaging $DMG_NAME..."
cp -R "$APP_BUNDLE_DIR" "$DMG_STAGING_DIR/"
ln -s /Applications "$DMG_STAGING_DIR/Applications"
hdiutil create -volname "Klovi" -srcfolder "$DMG_STAGING_DIR" -ov -format ULFO "$DMG_NAME"
rm -rf "$DMG_STAGING_DIR"

# --- Summary ---
DMG_SIZE=$(du -h "$DMG_NAME" | cut -f1)
echo ""
echo "=== Build complete ==="
echo "  App:     $APP_BUNDLE_DIR"
echo "  DMG:     $DMG_NAME ($DMG_SIZE)"
echo "  Env:     $BUILD_ENV"
echo "  Version: $VERSION"
