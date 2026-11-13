/**
 * The buddy rising into view from behind the prompt: the band grows a row at a
 * time, and each new row is the next one down, so the crown shows first with
 * nothing under it, then the crown and the ears with the crown a row higher.
 * Pure: register.tsx owns the timer and the redraw, this says what each step
 * shows. No `$`, so it tests under plain Node.
 *
 * The band is as tall as what is drawn, so each step pushes what is above it up
 * one row. That is the price of the buddy appearing to rise.
 */

/** How long each row is held as the buddy rises, when /config says nothing. */
export const RISE_MS = 120

/** The longest the buddy is ever drawn: the sprite's rows and the name. */
export const RISE_ROWS = 6

/** The slowest step a person can ask for, so a typo cannot leave the buddy half drawn. */
export const RISE_MAX_MS = 1000

/**
 * The per-row hold from the `/config` row: a number from 0 up (0 turns the rise
 * off), else the default.
 */
export function clampRise(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return RISE_MS
  return Math.min(Math.round(value), RISE_MAX_MS)
}

/**
 * The first `shown` of `rows`: row 0, then rows 0 and 1, and so on, with nothing
 * drawn below them. `shown` at or past the row count is every row, which is how
 * a finished rise is drawn.
 */
export function risenRows(rows: readonly string[], shown: number): string[] {
  return rows.slice(0, Math.max(0, shown))
}

/**
 * The step after `shown` rows: one more, or null once the buddy is whole. Null
 * in is null out, a rise that is not running.
 */
export function nextRise(shown: number | null): number | null {
  if (shown === null) return null
  return shown + 1 >= RISE_ROWS ? null : shown + 1
}
