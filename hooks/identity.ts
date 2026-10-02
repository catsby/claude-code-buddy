// Who the buddy is: written down, and the person's to change.
//
// The original derived species, hat and eyes from the user's ID every session
// and never stored them, precisely so that an edited config could not change
// what you got. Here the traits are stored and the store is the authority:
// nothing recomputes them behind your back (docs/scope.md).
//
// Reading is forgiving field by field. A trait the table does not know falls
// back to Gristle's for that trait alone, so a typo in one field draws a cat
// with the wrong hat rather than no buddy at all. That is not policing: any
// value the table can draw is kept, whatever produced it.

import { EYES, HAT_LINES, SPECIES, SPECIES_WIDTH, type Bones, type Eye, type Hat, type Species } from './species.ts'

export type Identity = {
  species: Species
  hat: Hat
  eye: Eye
  name: string
  /** The sprite's color. Unset, the `/config` color row decides. */
  color?: string
}

/** The `$.store` key the identity lives under. */
export const IDENTITY_KEY = 'identity'

/** The `$.store` key the buddy before the last roll lives under: one undo. */
export const PREVIOUS_KEY = 'previous'

/**
 * The longest name the band draws whole: one table row. Anything that writes a
 * name rejects a longer one rather than store a name that would be cut off.
 */
export const NAME_MAX = SPECIES_WIDTH

/**
 * A name as it would be stored: trimmed, or undefined when it is blank or too
 * long to draw whole. Names are rejected, never cut.
 */
export const cleanName = (raw: unknown): string | undefined => {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return trimmed && trimmed.length <= NAME_MAX ? trimmed : undefined
}

/** The buddy before anyone has changed anything. */
export const GRISTLE: Identity = { species: 'cat', hat: 'tophat', eye: '✦', name: 'Gristle' }

const oneOf = <T extends string>(allowed: readonly T[], v: unknown, fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback

const HATS = Object.keys(HAT_LINES) as Hat[]

/**
 * The identity a stored value describes, each field it gets wrong replaced by
 * Gristle's. Nothing stored at all is Gristle.
 */
export function identityFrom(stored: unknown): Identity {
  const s = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<string, unknown>
  const name = cleanName(s.name) ?? GRISTLE.name
  const identity: Identity = {
    species: oneOf(SPECIES, s.species, GRISTLE.species),
    hat: oneOf(HATS, s.hat, GRISTLE.hat),
    eye: oneOf(EYES, s.eye, GRISTLE.eye),
    name,
  }
  if (typeof s.color === 'string' && s.color.trim()) identity.color = s.color.trim()
  return identity
}

/** What the species table needs to draw an identity. */
export function bonesOf({ species, hat, eye }: Identity): Bones {
  return { species, hat, eye }
}
