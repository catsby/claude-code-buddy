import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'

/** The pane the plugin runs in, as `REX_BLOCK` names it. */
export const REX_BLOCK = 'block:mine'
export const REX_SESSION = 'session:one'

/**
 * Rex as the plugin sees it: `REX_SESSION` and `REX_BLOCK` set, and every
 * `rex session inspect` answered with whichever pane `state.focused` names.
 * Set `state.fails` and the call exits non-zero, as when the server is gone.
 *
 * @param on the test's `on`
 * @returns `state` the test moves, and `calls` every command the plugin ran
 */
export const rexFocus = (
  on: On,
): { state: { focused: string; fails: boolean }; calls: string[][] } => {
  const state = { focused: REX_BLOCK, fails: false }
  const calls: string[][] = []
  mock.env(on, { REX_SESSION, REX_BLOCK })
  on('process.run', ($, e) => {
    calls.push([...e.argv])
    return { value: {
      exitCode: state.fails ? 1 : 0,
      stdout: state.fails
        ? ''
        : JSON.stringify({
            active_window_id: 'w2',
            windows: [
              { window_id: 'w1', focused_block_id: 'block:elsewhere' },
              { window_id: 'w2', focused_block_id: state.focused },
            ],
          }),
      stderr: state.fails ? 'no server' : '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    } }
  })
  return { state, calls }
}
