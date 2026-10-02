import type { RenderInput } from 'claude-code'

/**
 * The band above the prompt on a 120-column terminal with room to spare: tall
 * enough for the hearts' row, wide enough for the sprite and the collapse mark.
 */
export const BAND: RenderInput<'AbovePrompt'> = {
  component: 'AbovePrompt',
  surface: 'terminal',
  requestId: 'band',
  viewport: { columns: 120, rows: 40, isFullscreen: true },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
}
