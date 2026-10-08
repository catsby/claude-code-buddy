import type { RenderInput } from 'claude-code'

/**
 * The buddy's pane docked beside the transcript on a 150-column terminal.
 */
export const PANE: RenderInput<'Pane'> = {
  component: 'Pane',
  surface: 'terminal',
  requestId: 'buddy',
  viewport: { columns: 150, rows: 40, isFullscreen: true },
  props: {
    title: 'Gristle',
    isFocused: false,
    bodyColumns: 22,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
}
