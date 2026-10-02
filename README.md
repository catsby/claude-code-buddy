# buddy

Gristle, the Claude Code Buddy cat, back above the prompt as a mod.

```
 [___]
 /\_/\
( ✦   ✦)
(  ω  )
(")_(")
 Gristle
```

Anthropic shipped `/buddy` in April 2026 and removed it a few weeks later.
Several projects brought it back through MCP servers, status lines, shell hooks
or by patching the binary. This one uses [mods](https://github.com/anthropics/claude-code/tree/main/mods),
the function-hook plugin API, so the cat is drawn by Claude Code's own renderer
in the band above the prompt.

What is here: the sprite and its idle poses, all eighteen species, `/buddy
pet`, `/buddy roll` and `/buddy name`. No speech, no reactions to the conversation, no stat
card yet.

[docs/scope.md](docs/scope.md) inventories what the original `/buddy` did and
decides each part: what is restored, what is planned, and what is deliberately
left out. The short version is that this restores the pet, not the observer —
nothing here reads your conversation or spends tokens.

## Running it

Needs Claude Code 2.1.287 or later:

```sh
claude --plugin-dir /path/to/this/repo
```

`/buddy off` hides the buddy, `/buddy on` (or bare `/buddy`) brings it back, and
the choice persists across sessions. `/buddy pet` floats three hearts on the
row above the hat for about two seconds and answers `petted Gristle`, as the
original did. Sprite color, heart color and both cadence values are `/config`
rows under this plugin.

`/buddy roll` gives the buddy new looks by the original's odds (rarity, species,
eyes, and a hat above common), keeping its name. `/buddy roll back` undoes the
last roll, once. `/buddy name <name>` renames the buddy (1 to 12 characters;
a longer or blank name is refused, not cut).

Built against Claude Code 2.1.285; checked on 2.1.287. The mod API is early access and changes
between releases.

## Where it draws

The original drew the buddy in the right-hand gutter, level with the input.
This build has fourteen hookable render sites and none of them is that gutter,
so it sits right-aligned in the band directly above the prompt instead: one row
off, same silhouette. [docs/placement.md](docs/placement.md) has the reasoning,
how the band is shared with other mods, and how to verify a drawing landed.

Ctrl+X Ctrl+A collapses the band and hides the buddy. That is Claude Code's
control, not this plugin's.

## The animation

The cat cycles rest, tail flick, rest, ear twitch. Only one row changes per
pose, so the timer fires on the change rather than at a frame rate and the
engine repaints the single cell.

The hat, face and ear twitch were read frame by frame off a screen recording of
the original. The tail flick never fires in those 6.7 seconds, but a screenshot
of the same buddy taken days later shows it plainly. Both are kept out of the
repo. The cadence is still ours, though the original's has since been measured
off a longer recording: a blink and both flicks on a 7.5-second cycle.

## Development

```sh
node --experimental-strip-types --test 'hooks/*.spec.ts'
claude plugin test .
```

Sprite geometry and cadence live in `hooks/sprite.ts` as pure functions so they
can be tested without an engine. `claude plugin test` runs `tests/` against the
engine's own `$`: the commands, the store, the pose and heart timers, and the
tree the band draws. What actually reached the terminal is checked by running
the real thing — `scripts/drive.exp` spawns a session under a PTY and
captures it.

To typecheck, use the declarations the engine writes to `.claude-plugin/types/`
when it loads the plugin. They are pinned to a version and gitignored:

```sh
npx -p typescript tsc --noEmit
claude plugin validate ./.claude-plugin/plugin.json
claude plugin validate . --strict
```

The first validate covers the plugin and reports what the engine sees the hooks
module hooking and calling; the second covers the marketplace manifest. The first
is not run with `--strict` because the validator warns about `CLAUDE.md` at the
plugin root, which is this repo's own instructions rather than context shipped to
whoever installs the plugin.

## Credits

The sprite table in [cpaczek/any-buddy](https://github.com/cpaczek/any-buddy)
(WTFPL) carried the tail-flick pose before a screenshot of the original turned
up, and is where the other seventeen species come from: the whole table is
vendored into `hooks/species.ts` from commit `b5e7eb0`. Its cat matches the one
we measured off the recording glyph for glyph, in all three frames — the tests
check it, so the two readings stay honest about each other.
Its roll (`src/generation/roll.ts`) is where `hooks/roll.ts` takes the rarity
weights and the hat rule from.

[rjwittams/katzensteg](https://github.com/rjwittams/katzensteg) is the reference
for hooking `AbovePrompt` without stomping on whatever else draws there.

`/buddy` itself was Anthropic's, and this is an affectionate reconstruction of
it, not a copy of its code.

## License

MIT. See [LICENSE](LICENSE).
