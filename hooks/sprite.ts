// The sprite as the April 2026 build drew it.
//
// The hat, the face and the ear twitch were read back frame by frame off a
// 6.7-second screen recording of the original. The third pose, the tail flick,
// never fires in that footage, and for a while it rested on the sprite table in
// cpaczek/any-buddy (WTFPL), whose other two cat frames match the recording
// glyph for glyph. It no longer has to: a screenshot of the same buddy, taken
// days later, shows `(")_(")~` outright. Both are kept out of the repo.
//
// The cadence is ours. The original's was measured later (CLAUDE.md, "Sprite
// provenance") and differs: a blink as well as both flicks, on 500ms steps.
//
// The band no longer draws `bodyLines`: it draws the vendored table in
// species.ts, which is 12 columns wide and holds every species. These eight
// columns stay as the measured reading, and species.spec.ts asserts the table's
// cat is this drawing.

import { CAT_INSET, SPECIES_WIDTH } from './species.ts'

/** The measured drawing's width: the cat's ink, tail flick included. */
export const SPRITE_WIDTH = 8

export type Pose = 'rest' | 'tail' | 'ears'

/** The table frame each pose draws. The table's frames are in this order. */
export const FRAME_OF_POSE: Readonly<Record<Pose, number>> = { rest: 0, tail: 1, ears: 2 }

/** any-buddy calls this one the top hat; their crown is `\^^^/`. */
const TOP_HAT = ' [___]'
const EARS: Record<Pose, string> = {
  rest: ' /\\_/\\',
  tail: ' /\\_/\\',
  ears: ' /\\-/\\',
}
const EYES = '( ✦   ✦)'
const MOUTH = '(  ω  )'
const FEET: Record<Pose, string> = {
  rest: '(")_(")',
  tail: '(")_(")~',
  ears: '(")_(")',
}

/**
 * Rest between flicks, and alternate which end moves: a cat that twitched the
 * same ear on a fixed beat would read as a spinner.
 */
export const CYCLE: readonly Pose[] = ['rest', 'tail', 'rest', 'ears']

export function poseAt(step: number): Pose {
  return CYCLE[((step % CYCLE.length) + CYCLE.length) % CYCLE.length]!
}

const pad = (line: string) => line.padEnd(SPRITE_WIDTH, ' ')

/** The five sprite rows for a pose, each padded to SPRITE_WIDTH. */
export function bodyLines(pose: Pose): string[] {
  return [TOP_HAT, EARS[pose], EYES, MOUTH, FEET[pose]].map(pad)
}

/**
 * The dim name row under the sprite, `SPECIES_WIDTH` wide. The recording puts
 * the name at the cat's own column 0, so it is inset to match; a name too long
 * for that gives up the inset before it gives up letters. Past the full width
 * it is cut, but identity.ts never hands this one: a name over NAME_MAX is
 * rejected before it is drawn.
 */
export function nameLine(name: string): string {
  const inset = Math.max(0, Math.min(CAT_INSET, SPECIES_WIDTH - name.length))
  return (' '.repeat(inset) + name).slice(0, SPECIES_WIDTH).padEnd(SPECIES_WIDTH, ' ')
}

export type Cadence = { restMs: number; flickMs: number }

/** How long the current pose is held before the next one. */
export function holdMs(pose: Pose, cadence: Cadence): number {
  return pose === 'rest' ? cadence.restMs : cadence.flickMs
}

/**
 * A cadence the engine will accept: a timer under a tick is refused, and a
 * rest under a second reads as a stutter rather than a cat.
 */
export function clampCadence(restMs: unknown, flickMs: unknown): Cadence {
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return {
    restMs: Math.max(1000, num(restMs, 2600)),
    flickMs: Math.max(80, num(flickMs, 400)),
  }
}
