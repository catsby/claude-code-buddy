# Why the cat draws above the prompt

The April 2026 feature drew the buddy in the right-hand gutter, level with the
prompt input, with a speech bubble to its left. This mod cannot put it back
exactly there, and this is the reasoning.

## The render sites a mod can hook

`ui.render` fires per component instance, and `RenderComponent` in Claude Code
2.1.273 is a closed list of fourteen:

```
AskUserQuestion  UserMessage  AssistantMessage  ToolUse  ToolResult
ToolGroup        CommandOutput  Spinner  TurnDuration  InfoNotice
SessionMode      PromptHint     AbovePrompt  Pane
```

None of them is that gutter. Of the fourteen, three sit near the prompt:

- `SessionMode` — the dim mode labels at the right of the prompt footer. Right
  placed, but it is a list of label strings on one line.
- `PromptHint` — the dim hint line under the prompt. One string, one line.
- `AbovePrompt` — the band directly above the prompt input, where the surveys
  draw and where the engine draws nothing of its own. A tree, any height.

A five-row sprite only fits the third. Right-aligned in that band, the cat sits
above-right of the prompt instead of beside it: one row off the original,
same silhouette.

## Sharing the band

The band belongs to whoever draws in it, so the hook yields rather than fights:

- `e.props.hasSurvey` — a survey is holding the band; it outranks a cat.
- `e.surface !== 'terminal'` — the band is terminal-only. Desktop, mobile and
  VS Code have no equivalent.
- `e.props.maxRows` under the sprite's height, or `bodyColumns` too narrow —
  not enough room to draw honestly, so draw nothing.

It composes rather than replaces. Whatever another plugin drew comes back from
`next(e)` and is kept below the cat, so a second `AbovePrompt` mod still works.
[rjwittams/katzensteg](https://github.com/rjwittams/katzensteg) is the reference
for that idiom.

## The collapse mark

The engine draws the band's own collapse affordance, `[-]`, hard against the
right edge and on top of whatever the hook put there. It overlapped the hat
until the sprite was held four columns clear of it. Ctrl+X Ctrl+A collapses the
band and hides the cat with it; that is the engine's control, not this plugin's.

## The block is wider than the cat

The band draws the vendored species table, whose rows are 12 columns
(`SPECIES_WIDTH`) because the widest species use all of them. The cat is 8 of
those, two columns in. `/buddy pet` puts hearts two columns left of the cat and
one past its right, which is table columns 0 through 10, so the heart row fits
the same 12 and nothing needs a margin. Every row is one width, so
right-alignment pins the block and the cat keeps its column whether or not
hearts are showing: hat at column 107 in a 120-column terminal, before, during
and after a pet.

This was an 11-wide block (the 8-column sprite plus margins for the hearts'
reach) until the table landed. Moving to 12 shifted the cat one column left,
from 108.

The `bodyColumns` guard is sized to the block, not the sprite. The heart row is
dropped, rather than the whole band yielded, when `maxRows` cannot spare a
seventh row.

## Verifying a drawing

A tree that does not validate is not drawn, and the engine substitutes its own
with no error in the transcript. The only sign is a line in the debug log:

```
ui.render (AbovePrompt): a hook returned a tree that does not validate
```

So run with `--debug` and read the log. To check placement without a human at
the keyboard, drive a real session under a PTY and read the escape stream:

```sh
expect scripts/drive.exp   # spawn, wait, /quit
```

A correct draw shows cursor moves to the right-hand column followed by the
sprite rows, and then single-cell repaints as the poses change.
