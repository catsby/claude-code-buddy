import type { On } from 'claude-code'
import { mock, type MockClock } from 'claude-code/testing'

import { BENEATH } from './beneath.ts'

/**
 * The world beneath the plugin: a session to start, a command registry that
 * takes `/buddy`, the engine's own band to compose over, a clock that moves
 * only when the test moves it, and a store seeded with `stored`.
 *
 * The store is answered here rather than by `mock.store`, which owns
 * `store.set` outright and leaves no way to see what the plugin wrote.
 *
 * @param on the test's `on`
 * @param stored what the plugin's store holds at the start
 * @returns the clock, the store as the plugin left it, and every command the
 *   plugin registered
 */
export const beneathBuddy = (
  on: On,
  stored: Record<string, unknown> = {},
): { clock: MockClock; store: Map<string, unknown>; registered: string[] } => {
  const clock = mock.clock(on)
  const store = new Map(Object.entries(stored))
  const registered: string[] = []
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.render', () => BENEATH)
  return { clock, store, registered }
}
