#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

required_files=(
  metadata.json
  extension.js
  prefs.js
  src/aboutPage.js
  src/logging.js
  src/zmanimMenuButton.js
  src/kosher-zmanim.js
  schemas/org.gnome.shell.extensions.zmanbar.gschema.xml
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    printf 'Missing required file: %s\n' "$file" >&2
    exit 1
  fi
done

node --check extension.js
node --check prefs.js
node --check src/aboutPage.js
node --check src/logging.js
node --check src/zmanimMenuButton.js

python3 -m json.tool metadata.json >/dev/null

schema_tmp="$(mktemp -d)"
trap 'rm -rf "$schema_tmp"' EXIT
glib-compile-schemas --targetdir "$schema_tmp" schemas

for forbidden_path in \
  logs.txt \
  schemas/gschemas.compiled \
  workspace \
  list \
  gemini_prompt.txt \
  gemini_feedback.txt \
  "npm packages"; do
  if [[ -e "$forbidden_path" ]]; then
    printf 'Forbidden local/generated path is present: %s\n' "$forbidden_path" >&2
    exit 1
  fi
done

printf 'All checks passed.\n'
