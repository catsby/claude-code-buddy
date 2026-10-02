# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Claude Code **mod**: a plugin whose behaviour lives in a function-hook module
(`hooks/register.tsx`, `register(on, options)`, hooks shaped `($, e, next)`).
It draws an ASCII cat in the band above the prompt. The repo root *is* the
plugin — `.claude-plugin/plugin.json` sits at the top level, and
`.claude-plugin/marketplace.json` publishes that same root as `buddy@catsby-buddies`.

[docs/scope.md](docs/scope.md) is the feature contract: what the original
`/buddy` did, and which parts are restored, planned, or deliberately out. Read it
before proposing a feature. Anything that reads the conversation or spends tokens
per turn is out by decision, not by backlog.

One constraint shapes everything:

- **The API is early access and moves between releases.** The generated
  declarations in `.claude-plugin/types/` are the authority, never memory or a
  blog post. Regenerate after a Claude Code update.

## Commands

```sh
# Run it
claude --plugin-dir .

# Tests, pure sprite logic (no engine needed; this is what CI runs)
node --experimental-strip-types --test 'hooks/*.spec.ts'
node --experimental-strip-types --test --test-name-pattern 'tail flick' hooks/sprite.spec.ts

# Tests, register.tsx against the engine's own $ (local; needs an installed build)
claude plugin test .

# Types — the engine writes them to .claude-plugin/types/ when it loads the plugin
# (loading the plugin with --plugin-dir writes and refreshes them);
# version-pinned and self-gitignored
npx -p typescript tsc --noEmit

# Validate. TWO invocations: the root path resolves to the marketplace manifest
# and skips the hooks report, so the plugin manifest must be named explicitly.
claude plugin validate ./.claude-plugin/plugin.json   # plugin + hooks
claude plugin validate . --strict                     # marketplace

# See it actually draw, without a human at the keyboard
expect scripts/drive.exp 14 tui.log
expect scripts/pet-grid.exp /tmp 9   # /buddy pet, captured as text grids (needs tmux)
```

The plugin manifest is validated without `--strict` on purpose. This repo root is
both the plugin and the development repo, so the validator warns that CLAUDE.md
"is not loaded as project context" — true for a plugin shipped to consumers,
false here, where it is the repo's own instructions. That is the one expected
warning, plus the same one for `CLAUDE.local.md` on a machine that has one;
anything else is real.

CI runs only the pure tests and a manifest parse. Typechecking, validation and
`claude plugin test` are local steps because all three need an installed build.

The two test runners split by suffix, and the suffix is load-bearing.
`claude plugin test` takes every `*.test.ts` under the plugin root and cannot be
scoped to a subfolder (it needs `hooks/hooks.json` relative to its argument), so
the `node:test` files are `*.spec.ts` to stay out of its way. Kit tests live in
`tests/`, named for what they cover under `hooks/`, with shared fixtures one
export per file under `tests/fixtures/`. The kit allows one hook per event, so
`tests/fixtures/beneath-buddy.ts` answers `$.store` itself rather than using
`mock.store`, which would leave no way to read what the plugin wrote. JSX `key`s
do not survive into the drawn tree; find rows by text.

## Architecture

**`hooks/sprite.ts`**, **`hooks/hearts.ts`**, **`hooks/species.ts`**,
**`hooks/identity.ts`** and **`hooks/roll.ts`** — pure. Pose table, geometry,
cadence clamping; heart states and the row they draw on; the eighteen species
with their hats and eyes; who the buddy is; the original's odds for a new one
(the rng is passed in, so rolls test deterministically). No `$`, no engine imports, so
they test under plain Node. Every drawn row is `SPECIES_WIDTH` (12) wide so
the block stays rectangular when right-aligned.

The band draws `species.ts`, the vendored table, not `sprite.ts`'s
`bodyLines`. The table is 12 columns because two species (mushroom, axolotl)
use every column. `bodyLines` stays as the 8-column measured reading, and
`species.spec.ts` asserts the table's cat is that drawing, offset by
`CAT_INSET` (2). Anything measured against the cat — heart columns, the name
row — is stored cat-relative and shifted by `CAT_INSET` onto the table's grid.

`identity.ts` is the stored buddy: species, hat, eye, name, and an optional
color that outranks the `/config` color row. It lives under `$.store` key
`identity` beside `hidden`, and defaults to Gristle. Reading falls back field by
field, so a value the table cannot draw costs that one trait, not the buddy. A
name longer than `NAME_MAX` (12) counts as one: names are rejected, never cut.
Nothing recomputes it: per `docs/scope.md`, a generator may write it, never
overrule it. The shape is not frozen until the plugin is published.
Rarity is rolled (it gates the hat and names the roll message) but is never
stored or drawn: `identityFrom` drops a stored `rarity`, so
`identityFrom({ ...before, ...rolled })` is safe.

**`hooks/register.tsx`** — three hooks:

- `session.start` registers `/buddy` and kicks off the pose timer off the
  critical path (a store read here would hold the first prompt).
- `command.run` on `{ command: 'buddy' }` serves `on`/`off`/`pet`/`roll`/`roll
  back`. `on`/`off` persist `hidden`; `roll` writes `identity` and keeps the
  buddy it replaced under `previous`, which `roll back` restores and deletes (one
  undo, not a history). A pet is transient module state and persists nothing.
- `ui.render` on `{ component: 'AbovePrompt' }` draws the tree.

**Module state survives nothing.** A hot reload (`--plugin-dir` watches the
folder) re-evaluates the module, so every module variable starts over and the
old environment's timers are dropped. Measured on 2.1.287 with a probe mod:
the engine then raises `session.start` again for the reloaded mod, with module
variables reset (the debug log says `session.start: raised for <mod> (loaded
later)`). This file used to say it did not. `ensureRunning($)` is still
called from the render and command hooks, now as a safety net: it re-arms the
timer and re-reads `$.store` (one shared read, however many callers) on the
next draw or `/buddy`. Anything that must outlive a reload belongs in `$.store` (or
`$.state`, which also survives a reload but resets on `/clear`), not in a
module variable.

**Drawing rules** (see `docs/placement.md` for the full reasoning):

- Resolve elements per surface with `await $.ui.resolve(e)`; a module has no
  element globals.
- Compose, never replace: `{await next(e)}` goes in the returned tree so a second
  `AbovePrompt` mod still works.
- Yield the band on `e.props.hasSurvey`, `e.surface !== 'terminal'`, or when
  `maxRows`/`bodyColumns` cannot fit the sprite.
- Right-align a multi-line block with an outer row `Box` (`justifyContent:
  'flex-end'`) wrapping an inner column `Box`. `alignItems: 'flex-end'` on the
  column would right-align each line *individually* and shear the sprite apart.
- The engine paints its own collapse mark `[-]` over the band's right edge, so
  the sprite is held `COLLAPSE_MARK_COLUMNS` clear of it.
- Every row, the heart row included, is `SPECIES_WIDTH` (12) wide, and the
  hearts' reach (two left of the cat, one past it) falls inside it. So the
  column is one width whether or not hearts are showing, and the cat keeps its
  column when a pet starts and ends. Verified in a 120-column terminal: hat at
  column 107 before, during and after a pet (`pet-grid.exp`).

**Animation** is driven by `$.clock.after` chained to the next pose's hold time,
not a frame-rate timer: one redraw per pose change, and the engine repaints only
the changed cells.

## Debugging a drawing that does not appear

A tree that fails validation is replaced by the engine's own. In a
`--plugin-dir` session the transcript gets a line such as `ui.render
(AbovePrompt) refused: <reason>; the engine drew its own`; anywhere else the
only record is the debug log:

```sh
claude --plugin-dir . --debug
rg "buddy|does not validate" ~/.claude/debug/$(ls -t ~/.claude/debug | head -1)
```

`claude plugin validate ./.claude-plugin/plugin.json` also prints what the engine
sees the module hooking and calling, which catches a hook that never registered.

## Sprite provenance

Poses and hearts are evidence, not invention. The hat, face and ear twitch were read frame
by frame off a screen recording of the original `/buddy` (not kept in the repo);
the tail flick never fires in that footage, but a screenshot of the same buddy
taken days later shows it outright. The sprite table in
[cpaczek/any-buddy](https://github.com/cpaczek/any-buddy) (WTFPL) carried that
pose until the screenshot turned up, and is where the other 17 species come
from — vendored into `hooks/species.ts` from commit `b5e7eb0`, byte for byte.
Its cat agrees with our measured one exactly, which is asserted, not assumed.
The heart columns, glyphs and holds
were measured off the same recording; any-buddy has no heart data, and neither
does ramarivera/coding-buddy, whose `/buddy pet` only prints a line.

The recording is variable-frame-rate: 41 frames over 6.7s, one per actual
repaint, so frame timestamps are repaint times. Extract with `-fps_mode
passthrough` and read `pts_time`, never a fixed `fps=` filter — sampling at
5fps merged two heart states into one and put the pet at 1.8s instead of 2.06s.
Pose cadence is still ours, but the original's is now measured: in
`gristle_comments.mp4` (2.1.89, 60fps constant) the idle cycle is tail at +0s,
blink (eyes `-`) at +2.0s, ears at +3.5s, each held 0.50s, repeating every
7.53s across 14 clean cycles. That is any-buddy's `IDLE_SEQUENCE`
(`[0,0,0,0,1,0,0,0,-1,0,0,2,0,0,0]` at 500ms) exactly, so the measurement is
ours and the sequence is confirmed, not copied.

## Using someone else's work

Several projects rebuilt `/buddy` and each transcribed the same sprite data, so
a fact confirmed in three of them is still one fact. Two rules:

- **Check the licence before a file is used, not after.** Consulting a source to
  settle a question is fine whatever its licence. Copying from it is not.
  any-buddy is WTFPL, which asks for nothing. coding-buddy is MIT with a LICENSE
  file, so its copyright notice has to travel with anything taken. buddy-reroll
  and ccbuddyy declare MIT but ship no LICENSE file, so there is no notice to
  reproduce. The `ccba` gist states no licence at all, which means all rights
  reserved — read it, verify against it, copy nothing from it.
- **Credit a source when its work is in the repo**, in the header of the file
  that carries it and in README's Credits. A source that only confirmed
  something we already had does not need a credit; say so in the commit instead.
  Do not list projects we merely looked at, or the credits stop meaning anything. Keep new glyphs sourced the same way and say which
is which in the comment header.

## Naming

Plugin `buddy`, command `/buddy`, default cat `Gristle`, repo `claude-code-buddy`.
`$.store` keys and `/config` rows are scoped by plugin name, so renaming the
plugin orphans installed users' state.
