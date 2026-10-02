---
name: release
description: Cut a release of the buddy plugin. Bumps the version, runs every check, and prepares the tag. Use when asked to release, bump the version, or tag.
disable-model-invocation: true
argument-hint: <version, e.g. 0.3.0>
---

# Release

Version to release: `$ARGUMENTS`. If it is empty or not `MAJOR.MINOR.PATCH`, ask.

Commit, tag and push only when the user says so for this release. Preparing
everything and stopping before them is the default.

## 1. Preconditions

- `git status --short` is clean apart from the release changes. Anything else
  uncommitted belongs in its own commit first.
- On `main`, and `git log --oneline -5` shows nothing half-finished.
- README's "What is here" line matches what the commands actually do. Verify
  each command named there with `rg` in `hooks/register.tsx`. A feature that was
  planned or closed without being built is not "here".

## 2. Bump

The version lives in one place: `.claude-plugin/plugin.json`. The marketplace
entry (`.claude-plugin/marketplace.json`) has no version. Edit `"version"` and
check nothing else carries the old number: `rg -F '<old version>' --glob '!.git'
--glob '!.claude/types'`.

## 3. Checks (all of them, in this order)

```sh
node --experimental-strip-types --test 'hooks/*.spec.ts'   # what CI runs
npx -p typescript tsc --noEmit
claude plugin test .                                        # needs an installed build
claude plugin validate ./.claude-plugin/plugin.json         # plugin + hooks, no --strict
claude plugin validate . --strict                           # marketplace
```

Expected: the plugin manifest validates with exactly one warning (CLAUDE.md "is
not loaded as project context", plus the same for `CLAUDE.local.md` on a machine
that has one). Any other warning is real. Report failures with the output; do not
continue past one.

## 4. Hand off

Report: the version change, each check's result, and the proposed commands.
Then wait.

```sh
git commit -am "v<version>"
git tag v<version>
git push && git push origin v<version>
```

The repo has no tags yet, so `v0.2.0` is the first. Tag names are `v` plus the
plugin version.
