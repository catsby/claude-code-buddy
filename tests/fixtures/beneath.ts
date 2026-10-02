import type { RenderElement } from 'claude-code'

/**
 * What the engine draws in the band, standing in beneath the plugin: the tree
 * the plugin must compose rather than replace, and all that is left once it
 * yields.
 */
export const BENEATH: RenderElement = {
  type: 'Text',
  children: ['engine band'],
}
