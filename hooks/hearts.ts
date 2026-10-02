// The hearts `/buddy pet` floated, as the April 2026 build drew them.
//
// Measured off gristle_snark.mov, a screen recording of the original (kept out
// of the repo). The file is variable-frame-rate: it holds 41 frames for 6.7
// seconds, and a frame exists only where the screen actually repainted, so the
// frame timestamps are repaint times rather than samples. That is where the
// holds below come from — they are measured, not guessed.
//
// Columns are sprite-relative, read against the hat's `[` and `]`, which are
// four cells apart and so fix the cell width at 11px. Three hearts in every
// state. They start inside the sprite and drift outward, reaching a column
// past it on each side before fading.
//
// One frame is deliberately not a state here. At t=2.205 the row appears with
// hearts at columns 1 and 6 and a third that never resolved, and it is replaced
// 52ms later — a tenth of every other hold, with a glyph missing. That reads as
// a torn first paint rather than a pose, so the animation starts at t=2.257.
//
// The blogs say the original ran 2.5s. These holds total 2.06s, and the clear
// lands somewhere in (3.800, 4.315], so the true figure is 2.06s or a little
// more. Close enough to the blogs that the earlier 1.8s reading was simply the
// cost of sampling at 5fps.

import { CAT_INSET, SPECIES_WIDTH } from './species.ts'

const HEART = '♡'
const FADED = '·'

type HeartState = {
  /** Columns relative to the cat's left edge; outside 0..7 reaches past it. */
  cols: readonly number[]
  glyph: string
  holdMs: number
}

/** t = 2.257, 2.777, 3.280 and 3.800 in the recording. */
const STATES: readonly HeartState[] = [
  { cols: [0, 3, 7], glyph: HEART, holdMs: 520 },
  { cols: [-1, 3, 6], glyph: HEART, holdMs: 503 },
  { cols: [-2, 1, 8], glyph: HEART, holdMs: 520 },
  { cols: [-2, 3, 7], glyph: FADED, holdMs: 515 },
]

export const HEART_STEPS = STATES.length

/** How long state `step` is held before the next one. */
export function heartHoldMs(step: number): number {
  return STATES[step]?.holdMs ?? 0
}

/**
 * The heart row for a state, `SPECIES_WIDTH` wide, or null once the
 * pet has run out of states and the row should go away.
 */
export function heartRow(step: number): string | null {
  const state = STATES[step]
  if (!state) return null
  const cells = Array<string>(SPECIES_WIDTH).fill(' ')
  for (const col of state.cols) {
    // Measured against the cat, which the table draws CAT_INSET columns in.
    cells[col + CAT_INSET] = state.glyph
  }
  return cells.join('')
}
