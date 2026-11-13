# Why the cat draws above the prompt

The April 2026 feature drew the buddy in the right-hand gutter, level with the
prompt input, with a speech bubble to its left. This mod cannot put it back
exactly there, and this is the reasoning.

## The render sites a mod can hook

`ui.render` fires per component instance, and `RenderComponent` is a closed
list. In 2.1.273 it held fourteen:

```
AskUserQuestion  UserMessage  AssistantMessage  ToolUse  ToolResult
ToolGroup        CommandOutput  Spinner  TurnDuration  InfoNotice
SessionMode      PromptHint     AbovePrompt  Pane
```

The 2.1.325 types add `ToolProgress`, `AbovePromptList`, `Placed` (a row a mod
put in the transcript with `$.ui.place`) and `Backdrop`. None of them is that
gutter. Of the original fourteen, three sit near the prompt:

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
- `e.surface !== 'terminal'` — the mod yields everywhere but the terminal. The
  2.1.325 types say the band is raised on terminal, desktop and mobile (not
  VS Code), but this mod has only been measured in the terminal.
- `e.props.maxRows` under the sprite's height, or `bodyColumns` too narrow —
  not enough room to draw honestly, so draw nothing. `maxRows` is, in
  fullscreen, what the bottom slot has left above the prompt (that slot is
  capped at half the terminal's rows, the prompt's included); otherwise the
  terminal's height. A taller tree scrolls in a `scroll.bodyRows` window.
- `e.props.isCollapsed` is true while the person has collapsed the band: a tree
  still returns and none of it is on screen. The mod does not read it yet, so
  the pose timer keeps redrawing into a hidden band. (The public docs say a mod
  cannot detect collapse; the types say it can. The types are the authority.)

It composes rather than replaces. Whatever another plugin drew comes back from
`next(e)` and is kept below the cat, so a second `AbovePrompt` mod still works.
[rjwittams/katzensteg](https://github.com/rjwittams/katzensteg) is the reference
for that idiom.

## The collapse mark

The engine draws the band's own collapse affordance, `[-]`, at the right edge.
On 2.1.287 it overlapped the hat until the sprite was held four columns clear
of it. Since 2.1.289 the band's `bodyColumns` excludes the mark and keeps one
column in from the terminal's edge, so no margin is needed: measured on 2.1.295
in 120 columns, the block ends at column 115 and `[-]` sits at 116. The 2.1.325
types state it as the column's width "less the engine's five at the right end".
Ctrl+X Ctrl+A collapses the band and hides the cat with it; that is the
engine's control, not this plugin's.

## Pane seats

A `Pane` is drawn in one of three seats, reported on its `placement` prop:
`dock` beside the transcript (the terminal in fullscreen from 110 columns),
`inline` above the prompt, and `widget`, the small form of a minimized pane on
the desktop app only. A widget also carries `anchoredEdges` (which edges of the
chat area it sits on; `[]` in the session rail); no call moves one. This mod
treats `inline` as "not docked" and closes it, and anything else as docked,
which matches the types' instruction to treat an unknown seat as `dock`.

A pane the mod opens unasked (a timer, `turn.start`) is placed only from 144
columns, or 110 once the person has opened that id. One the person asks for
(`/buddy pane`) is placed at any width. `$.ui.open` resolves to `{ isPlaced,
reason }`, and `isPromptCovered` (2.1.323, `Pane` only) is true while a dialog
or field has the keyboard.

## The block is wider than the cat

The band draws the vendored species table, whose rows are 12 columns
(`SPECIES_WIDTH`) because the widest species use all of them. The cat is 8 of
those, two columns in. `/buddy pet` puts hearts two columns left of the cat and
one past its right, which is table columns 0 through 10, so the heart row fits
the same 12 and nothing needs a margin. Every row is one width, so
right-alignment pins the block and the cat keeps its column whether or not
hearts are showing: hat at column 106 in a 120-column terminal, before, during
and after a pet.

This was an 11-wide block (the 8-column sprite plus margins for the hearts'
reach) until the table landed. Moving to 12 shifted the cat one column left.
Dropping the collapse-mark margin on 2.1.295 moved it four columns right.

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

## Wishlist: what the engine would need to let the buddy float

The original buddy took no rows: it sat in the right gutter beside the prompt.
Every seat a mod can hook either costs rows (`AbovePrompt`, an inline `Pane`),
holds one line of text (`SessionMode`, `PromptHint`), or needs width to dock
(`Pane`, from 110 columns). In order of fit, what would fix it:

1. **A render site for the gutter beside the prompt** (say `BesidePrompt`),
   right-anchored and level with the input. It takes columns, not rows. This is
   where the original drew, speech bubble included.
2. **An absolute child that paints outside its site's region.** `position:
   "absolute"` already leaves the flow, but the engine clips it to the site's
   region, so a one-row band cannot anchor a cat that floats above it.
3. **Overlay rows that reserve no layout height.** A way to mark a site's rows
   as drawn over the transcript rather than pushing it up.

All three need engine support; a mod cannot work around the clipping.

### Evidence: absolute children are clipped to the band (2.1.325 types)

A throwaway plugin returned a one-row band with two absolute blocks:

```tsx
<Box flexDirection="column">
  <Box>
    <Text>BANDROW</Text>
    <Box position="absolute" top={-5} right={0} flexDirection="column">
      <Text>ABOVE0</Text>{/* ... through ABOVE4 */}
    </Box>
    <Box position="absolute" top={0} right={-8}><Text>PASTEDGE</Text></Box>
  </Box>
  {await next(e)}
</Box>
```

Captured with `tmux capture-pane` at 120x40:

- `ABOVE0` to `ABOVE4` (`top={-5}`) never appeared; the five rows above the
  band were blank. Vertical overflow is clipped.
- `PASTEDGE` (`right={-8}`) painted past the band's body, but only into the
  columns the engine reserves for `[-]`, and was cut at the terminal edge.
- Not tested: a block hanging below the band (`bottom={-N}`).

What would falsify this: the same probe on a later build painting `ABOVE0` to
`ABOVE4` above the band. Then the wishlist's second item has shipped, and the
cat could use a one-row band instead of six.
