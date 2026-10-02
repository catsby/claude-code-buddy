// A fresh buddy at random, by the original's odds.
//
// The rarity weights and the hat rule follow `src/generation/roll.ts` in
// cpaczek/any-buddy (WTFPL) at commit b5e7eb0, a transcription of the shipped
// build's roll: rarity by weight, then species and eye uniformly, and a hat only
// above common, drawn uniformly from all eight (so `none` can still come up).
// The blogs describe each rarity unlocking its own hats; the code does not, and
// the code is the better witness.
//
// Rarity is rolled for the hat rule and the line a roll answers with, and is
// not stored: with a free re-roll it would only be a number to farm. The
// identity keeps the looks that came of it.
//
// What any-buddy also rolls and this does not: stats (nothing draws them until
// the card) and shiny (nothing draws it yet). The name is never rolled; the
// buddy keeps the one it has.

import { EYES, HAT_LINES, SPECIES, type Eye, type Hat, type Species } from './species.ts'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

/** Out of 100. */
export const RARITY_WEIGHTS: Readonly<Record<Rarity, number>> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
}

const HATS = Object.keys(HAT_LINES) as Hat[]

export type Rolled = { species: Species; hat: Hat; eye: Eye; rarity: Rarity }

/** A uniform draw in [0, 1), as `Math.random` gives. */
export type Rng = () => number

const pick = <T>(rng: Rng, from: readonly T[]): T =>
  from[Math.min(from.length - 1, Math.floor(rng() * from.length))]!

export function rollRarity(rng: Rng): Rarity {
  let roll = rng() * 100
  for (const rarity of RARITIES) {
    roll -= RARITY_WEIGHTS[rarity]
    if (roll < 0) return rarity
  }
  return 'common'
}

/** One roll: rarity first, then species, eye and hat, in the original's order. */
export function roll(rng: Rng): Rolled {
  const rarity = rollRarity(rng)
  const species = pick(rng, SPECIES)
  const eye = pick(rng, EYES)
  const hat = rarity === 'common' ? 'none' : pick(rng, HATS)
  return { species, hat, eye, rarity }
}

const HAT_WORDS: Readonly<Record<Hat, string>> = {
  none: 'no hat',
  crown: 'a crown',
  tophat: 'a top hat',
  propeller: 'a propeller hat',
  halo: 'a halo',
  wizard: 'a wizard hat',
  beanie: 'a beanie',
  tinyduck: 'a tiny duck',
}

/** "an uncommon duck in a wizard hat", for the line a roll answers with. */
export function describe({ species, hat, rarity }: Rolled): string {
  const article = rarity === 'uncommon' || rarity === 'epic' ? 'an' : 'a'
  const wearing = hat === 'none' ? 'with no hat' : `in ${HAT_WORDS[hat]}`
  return `${article} ${rarity} ${species} ${wearing}`
}
