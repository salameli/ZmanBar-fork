#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if ! command -v zip >/dev/null 2>&1; then
  printf 'Missing required command: zip\n' >&2
  exit 1
fi

./scripts/check.sh

uuid="$(python3 -c 'import json; print(json.load(open("metadata.json"))["uuid"])')"
version_name="$(python3 -c 'import json; data=json.load(open("metadata.json")); print(data.get("version-name", data.get("version")))')"
package_name="${uuid}-${version_name}.zip"
dist_dir="$ROOT_DIR/dist"
staging_dir="$(mktemp -d)"
trap 'rm -rf "$staging_dir"' EXIT

mkdir -p "$dist_dir"
rm -f "$dist_dir/$package_name"

for path in \
  metadata.json \
  extension.js \
  prefs.js \
  schemas \
  src \
  assets \
  LICENSE; do
  cp -R "$path" "$staging_dir/"
done

(cd "$staging_dir" && zip -qr "$dist_dir/$package_name" .)

printf 'Created %s\n' "$dist_dir/$package_name"
