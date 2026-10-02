import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EYES, HAT_LINES, SPECIES } from './species.ts'
import { RARITIES, RARITY_WEIGHTS, describe, roll, rollRarity, type Rng } from './roll.ts'

/** An rng that answers these draws in order. */
const scripted = (...draws: number[]): Rng => {
  let i = 0
  return () => draws[i++] ?? 0
}

/** A small seeded rng, so the sampling tests are the same every run. */
const seeded = (seed: number): Rng => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

test('the weights are the original\'s and add to a hundred', () => {
  assert.deepEqual(RARITY_WEIGHTS, { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 })
  assert.equal(Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0), 100)
})

test('rarity falls where the weights put the boundaries', () => {
  assert.equal(rollRarity(scripted(0)), 'common')
  assert.equal(rollRarity(scripted(0.5999)), 'common')
  assert.equal(rollRarity(scripted(0.6)), 'uncommon')
  assert.equal(rollRarity(scripted(0.85)), 'rare')
  assert.equal(rollRarity(scripted(0.95)), 'epic')
  assert.equal(rollRarity(scripted(0.99)), 'legendary')
  assert.equal(rollRarity(scripted(0.999999)), 'legendary')
})

test('a common buddy never wears a hat', () => {
  const rolled = roll(scripted(0.1, 0.5, 0.5, 0.99))
  assert.equal(rolled.rarity, 'common')
  assert.equal(rolled.hat, 'none')
})

test('above common the hat is any of the eight, none included', () => {
  const hats = Object.keys(HAT_LINES)
  assert.equal(roll(scripted(0.7, 0, 0, 0)).hat, 'none')
  assert.equal(roll(scripted(0.7, 0, 0, 0.99)).hat, hats.at(-1))
  // An uncommon can roll the tiny duck: the tiers do not gate hats.
  assert.equal(roll(scripted(0.7, 0, 0, 7 / 8)).hat, 'tinyduck')
})

test('every roll is something the table can draw', () => {
  const rng = seeded(1)
  for (let i = 0; i < 2000; i++) {
    const r = roll(rng)
    assert.ok(SPECIES.includes(r.species))
    assert.ok(EYES.includes(r.eye))
    assert.ok(r.hat in HAT_LINES)
    assert.ok(RARITIES.includes(r.rarity))
  }
})

test('over many rolls the rarities land near their weights', () => {
  const rng = seeded(7)
  const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<string, number>
  const n = 20000
  for (let i = 0; i < n; i++) counts[rollRarity(rng)]! += 1
  for (const r of RARITIES) {
    const share = (counts[r]! / n) * 100
    assert.ok(Math.abs(share - RARITY_WEIGHTS[r]) < 1.5, `${r}: ${share.toFixed(1)}%`)
  }
})

test('a roll reads as a phrase', () => {
  assert.equal(
    describe({ species: 'duck', hat: 'wizard', eye: '◉', rarity: 'uncommon' }),
    'an uncommon duck in a wizard hat',
  )
  assert.equal(describe({ species: 'owl', hat: 'none', eye: '·', rarity: 'common' }), 'a common owl with no hat')
  assert.equal(describe({ species: 'cat', hat: 'tophat', eye: '✦', rarity: 'epic' }), 'an epic cat in a top hat')
})
