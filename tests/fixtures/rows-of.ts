import type { Mounted } from 'claude-code/testing'

/**
 * Every row the band shows, top to bottom, the engine's own last.
 *
 * @param ui the mounted band
 * @returns each Text's shown text
 */
export const rowsOf = async (ui: Pick<Mounted, 'findAll'>): Promise<string[]> =>
  (await ui.findAll({ type: 'Text' })).map((t) => t.text)
