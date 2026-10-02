#!/usr/bin/env bash
# Stop hook: when the turn leaves changed TypeScript, run the specs and tsc.
# Exit 2 sends the output back to Claude, which keeps going until it passes.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Already continuing because of this hook: let the turn end rather than loop.
[ "$(jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ] && exit 0

# Nothing changed in TypeScript (tracked or untracked), nothing to check.
git status --porcelain | rg -q '\.tsx?$' || exit 0

fail=0
out=$(node --experimental-strip-types --test 'hooks/*.spec.ts' 2>&1) || {
  printf 'spec tests failed:\n%s\n' "$out" >&2
  fail=1
}
# tsc needs the engine-generated declarations; without them it fails for
# reasons that are not the edit's.
if [ -d .claude-plugin/types ]; then
  out=$(npx -p typescript tsc --noEmit 2>&1) || {
    printf 'tsc --noEmit failed:\n%s\n' "$out" >&2
    fail=1
  }
fi
[ "$fail" -eq 0 ] || exit 2
