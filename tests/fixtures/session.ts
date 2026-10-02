import type { SessionStartInput } from 'claude-code'

/**
 * An interactive terminal session.
 */
export const SESSION: SessionStartInput = {
  surface: 'terminal',
  isInteractive: true,
  cwd: '/work',
}
