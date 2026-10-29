#!/usr/bin/env bash
# PostToolUse hook: lint the file Claude just edited and feed violations back.
# Exit 2 makes Claude Code show stderr to the agent, which then fixes the code.
set -euo pipefail

file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

# Resolve symlinks, or ESLint treats the file as outside the project and skips it.
file=$(realpath "$file")
cd "$(realpath "$CLAUDE_PROJECT_DIR")"
if ! out=$(pnpm exec eslint --no-warn-ignored "$file" 2>&1); then
  printf 'ESLint found convention violations in %s. Fix them (see docs/conventions/):\n%s\n' "$file" "$out" >&2
  exit 2
fi
