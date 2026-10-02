import type { CommandRunInput } from 'claude-code'

/**
 * `/buddy <args>` as the person types it in the fullscreen layout.
 *
 * @param args everything after the name
 * @returns the run
 */
export const buddy = (args: string): CommandRunInput => ({
  command: 'buddy',
  args,
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 120 },
})
