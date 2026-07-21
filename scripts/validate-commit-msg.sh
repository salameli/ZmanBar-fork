#!/usr/bin/env bash
set -euo pipefail

commit_msg_file="${1:-}"

if [[ -z "$commit_msg_file" || ! -f "$commit_msg_file" ]]; then
  printf 'Usage: %s <commit-msg-file>\n' "$0" >&2
  exit 2
fi

first_line="$(IFS= read -r line < "$commit_msg_file" && printf '%s' "$line")"

if [[ "$first_line" =~ ^(Merge|Revert)\  ]]; then
  exit 0
fi

if [[ "$first_line" =~ ^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9._-]+\))?!?:\ .+ ]]; then
  exit 0
fi

cat >&2 <<'EOF'
Commit message must follow Conventional Commits.

Expected format:
  type(scope): description
  type: description

Allowed types:
  build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test

Examples:
  docs: update contribution guide
  fix: correct location search error handling
  ci(checks): run validation workflow
EOF

exit 1
