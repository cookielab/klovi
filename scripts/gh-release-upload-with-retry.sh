#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: bash scripts/gh-release-upload-with-retry.sh <version> <file>" >&2
  exit 1
fi

VERSION="$1"
FILE_PATH="$2"
ATTEMPTS="${UPLOAD_ATTEMPTS:-5}"
DELAY_SECONDS="${UPLOAD_DELAY_SECONDS:-5}"

if [ ! -e "$FILE_PATH" ]; then
  echo "::error::Missing release asset: $FILE_PATH"
  exit 1
fi

attempt=1
while [ "$attempt" -le "$ATTEMPTS" ]; do
  if gh release upload "$VERSION" "$FILE_PATH" --clobber; then
    exit 0
  fi

  if [ "$attempt" -eq "$ATTEMPTS" ]; then
    break
  fi

  echo "::warning::Upload failed for $FILE_PATH (attempt ${attempt}/${ATTEMPTS}). Retrying in ${DELAY_SECONDS}s..."
  sleep "$DELAY_SECONDS"
  attempt=$((attempt + 1))
done

echo "::warning::Current release assets for $VERSION:"
gh release view "$VERSION" --json assets --jq '.assets[].name' || true

echo "::error::Failed to upload $FILE_PATH after ${ATTEMPTS} attempts"
exit 1
