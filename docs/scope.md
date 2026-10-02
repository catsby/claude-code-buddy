# What we are restoring, and what we are not

Anthropic shipped `/buddy` in Claude Code 2.1.89 (April 2026) and removed it a
few versions later, after a few weeks. This is an inventory of what it did, and
a decision on each part.

The short version: **the buddy is the point.** A small companion sitting beside
your work while you code, and nothing more than that.

Two things follow. The original also made the buddy watch your conversation and
comment on it; that is out, because something that reads your code and spends
tokens every turn is a different product. And the original locked your buddy the
day you got it; here you can change it. Changing is not the point either — it is
just possible.

## The original feature set

Reconstructed from [claudefa.st](https://claudefa.st/blog/guide/mechanics/claude-buddy),
the [dev.to guide](https://dev.to/damon_bb9e4bba1285afe2fcd/claude-buddy-the-complete-guide-to-your-ai-terminal-pet-all-18-species-rarities-hidden-22da),
the sprite tables in [cpaczek/any-buddy](https://github.com/cpaczek/any-buddy),
and screen captures of a live session.

### Presentation

| | |
|---|---|
| Sprite | 5 lines, 12 columns, 3 animation frames, drawn in the right-hand gutter beside the prompt input |
| Hat | Drawn on its own line above the body, 8 kinds |
| Eyes | One glyph substituted into the body: `·` `✦` `×` `◉` `@` `°` |
| Shiny | 1% independent roll, rainbow shimmer on the sprite |
| Speech bubble | Dashed box left of the sprite, `--` tail pointing at it |
| Stat card | Rarity stars, species, sprite, name, personality blurb, five stat bars, "last said" |

### Identity

18 species (duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle,
snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk), five
rarity tiers, five stats (DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK) with one
peak and one dump, and a name plus personality written once by the model.

Rarity set a stat floor and whether there was a hat: common 60% (floor 5), uncommon
25% (15), rare 10% (25), epic 4% (35), legendary 1% (50). A common buddy had no
hat; any other drew one uniformly from all eight, `none` included. The blogs
describe each tier unlocking its own hats (uncommon crown/top hat/propeller, rare
halo/wizard, epic beanie, legendary tiny duck), but the roll code transcribed in
any-buddy does not gate them that way, and the code is the better witness.

### Generation and anti-cheat

Everything above was derived deterministically from the user's ID by FNV-1a
hashing with the salt `friend-2026-401`. State was split in two: **bones**
(species, rarity, eyes, hat, shiny, stats) recomputed every session and never
persisted, and **soul** (name, personality, hatch date) written once by the model
and stored. Merging `{ ...stored, ...bones }` meant a hand-edited config could
never change what you got.

### Behaviour

The buddy was injected into the system prompt as a separate watcher, and reacted
to the conversation in speech bubbles. `/buddy` hatched it with an animation,
`/buddy pet` floated hearts for 2.5s, `/buddy card` showed the stat card,
`/buddy mute`/`unmute` controlled the bubbles, `/buddy off` hid it. Addressing it
by name got a personality-driven reply.

## Our decisions

### Restoring — built

- The sprite in Claude Code's own UI, drawn by the renderer rather than a status
  line or a separate window.
- Idle animation, as poses on a timer.
- `/buddy on` / `/buddy off`, persisted across sessions.
- `/buddy pet` and its hearts, and the `petted <name>` line the original
  printed. Purely local, no model involved. Three hearts on the row above the
  hat, drifting outward through three states and a fading fourth over about two
  seconds. Measured off a variable-frame-rate recording, where a frame exists
  only where the screen repainted, so the holds are the original's own.
- The 18 species, 8 hats and 6 eye glyphs, drawn from any-buddy's table.
- A name, drawn under the sprite. Gristle until you change it.
- A stored identity (species, hat, eyes, name, and an optional color
  that outranks the `/config` row), written down and never recomputed.
- Roll: `/buddy roll` by the original's odds, keeping the name, and
  `/buddy roll back` to undo the last one.
- `/buddy name <name>`: rename the buddy. A name is 1 to 12 characters and is
  rejected, never cut; every other trait is kept.

### Restoring — planned

- Stats: five, rolled with the buddy and stored in the identity. The card
  needs them.
- `/buddy card`. Species, sprite, name, five stat bars and a blurb that is
  yours to write rather than the model's to invent. No rarity stars: see below.
- Derive and build, the other two ways to get a buddy. See below.
- A way to change the color afterwards. The identity already stores it;
  nothing writes it yet.

### Keeping generation, dropping enforcement

The original's hashing did two jobs, and only one of them is worth keeping.

As a **generator** it was lovely. You ran `/buddy` and met someone you had not
picked, and the surprise was most of the charm. We want that, and there should be
more than one way in:

- **Roll** — a fresh one at random.
- **Derive** — one from a seed you supply: your username, your machine name, a
  word you like. The same input always gives the same buddy, so they can be
  shared and compared.
- **Build** — one outright, picking species, hat, eyes, color and name.

As **enforcement** it has to go, and that is the part that made the original what
it was. Bones were recomputed every session and never persisted *precisely* so
that editing your config could not change what you got; `{ ...stored, ...bones }`
guaranteed the recomputation won. However your buddy arrives here, the traits it
produces are written down and they are yours to change afterwards — species, hat,
eyes, name, all of it, whenever you like.

So: a hash may generate, but it may not police. No salt, no bones/soul split, no
recomputation behind your back, and nothing that treats an edited config as
cheating.

This also makes rarity meaningless. A re-roll is free, so a legendary is one
`/buddy roll` away and the tier says nothing about the buddy. It is still rolled,
by the original's odds, because it decides whether the buddy gets a hat and is
named in the line a roll answers with. It is not stored and the card does not
show it, and so the rarity colours are not needed. It can be brought back if
there is ever a reason. Stats have the same problem and are kept anyway: they
are decorative, a re-roll may change them, and the card draws them. They are
rolled with the buddy and stored, with rarity setting the floor as it did in
the original. Shiny
becomes a toggle rather than a 1% roll — though rolling should still be able to
grant one, or the surprise is gone.

### Not restoring

Everything that reads the conversation or spends tokens:

- Injecting the buddy into the system prompt as a watcher.
- Speech bubbles reacting to what you and Claude are doing.
- `/buddy mute` and `/buddy unmute` — there is nothing to mute.
- "Last said" on the card.
- Addressing the buddy by name to get a reply.

This is a deliberate line, not a backlog item. The mod should cost nothing per
turn and should not be able to say anything about your work. If speech ever
returns it will be opt-in and clearly priced, and the two viable designs are
recorded here so the thinking is not lost: a `turn.step` stream hook that pulls a
tagged span out of the reply (no extra request), or a `turn.complete` hook calling
`$.model.fork`, which reuses the session's prompt cache.

Also out: the phased rollout, the hatch gate, and the Pro-subscription check.
Install it and it is there.

## Naming note

The `[___]` Gristle wears is any-buddy's **top hat**, not their crown (`\^^^/`),
so Gristle is a top-hat cat however often we called it a crown. `sprite.ts` names
it `TOP_HAT` to match the vendored table.
