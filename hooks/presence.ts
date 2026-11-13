/**
 * Whether the buddy's own pane is the one the person is looking at, inside a
 * Rex session. Pure: the engine, the process call and the clock live in
 * register.tsx; this reads `rex session inspect --json` and steps a small
 * debounce, so both test under plain Node.
 *
 * Rex reports focus per session, not per screen: a session the person has left
 * keeps reporting its last focused block. So "focused" means "the focused pane
 * of this session's active tab", and two sessions can both say yes. That is
 * accepted: the buddy follows the person between tabs and between panes, and
 * between sessions only by whatever each session last saw.
 *
 * Only the fields read here are trusted. Anything else in the output, or a
 * shape that is not the one described, reads as "unknown", never as "away".
 */

/** How often register.tsx asks Rex. The lag is the point: the buddy catches up. */
export const POLL_MS = 2000

/** Consecutive focused polls before an absent buddy returns. Leaving takes one. */
export const ARRIVE_AFTER = 2

/**
 * Consecutive polls Rex may fail to answer before the plugin stops asking. A
 * missing `rex` binary (REX_* set inside a container, say) would otherwise be
 * spawned every `POLL_MS` for the whole session.
 */
export const FAIL_LIMIT = 3

export type Presence = { here: boolean; streak: number }

/** Before the first answer the buddy is shown, as it is outside Rex. */
export const START: Presence = { here: true, streak: 0 }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The block holding focus in the window the session is showing, from the JSON
 * `rex session inspect` prints, or undefined when the shape is not that.
 */
export function focusedBlock(view: unknown): string | undefined {
  if (!isRecord(view)) return undefined
  const { active_window_id: active, windows } = view
  if (typeof active !== 'string' || !Array.isArray(windows)) return undefined
  for (const window of windows) {
    if (isRecord(window) && window.window_id === active) {
      return typeof window.focused_block_id === 'string' ? window.focused_block_id : undefined
    }
  }
  return undefined
}

/**
 * Is `block` the focused pane, per the text `rex session inspect --json`
 * wrote? Undefined when the text cannot say: not JSON, not that shape.
 */
export function isFocused(stdout: string, block: string): boolean | undefined {
  let view: unknown
  try {
    view = JSON.parse(stdout)
  } catch {
    return undefined
  }
  const focused = focusedBlock(view)
  return focused === undefined ? undefined : focused === block
}

/**
 * The run of polls with no answer: back to 0 on any answer, one more on an
 * unknown one. At `FAIL_LIMIT` the plugin gives up and shows the buddy.
 */
export function stepFailures(failures: number, focused: boolean | undefined): number {
  return focused === undefined ? failures + 1 : 0
}

/**
 * One poll's answer folded into the state. An unknown answer (Rex missing, the
 * call failing, an unreadable reply) changes nothing, so the buddy is never
 * hidden by a fault. Leaving is immediate; arriving takes `ARRIVE_AFTER` polls
 * in a row, so a quick pass through a tab does not make the buddy flicker.
 */
export function stepPresence(state: Presence, focused: boolean | undefined): Presence {
  if (focused === undefined) return state
  if (!focused) return { here: false, streak: 0 }
  if (state.here) return { here: true, streak: 0 }
  const streak = state.streak + 1
  return streak >= ARRIVE_AFTER ? { here: true, streak: 0 } : { here: false, streak }
}
