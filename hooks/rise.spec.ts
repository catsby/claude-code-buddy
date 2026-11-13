import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { RISE_MAX_MS, RISE_MS, RISE_ROWS, clampRise, nextRise, risenRows } from './rise.ts'

const ROWS = ['hat', 'ears', 'face', 'body', 'feet', 'name']

describe('risenRows', () => {
  test('shows the top rows first and nothing below them', () => {
    assert.deepEqual(risenRows(ROWS, 0), [])
    assert.deepEqual(risenRows(ROWS, 1), ['hat'])
    assert.deepEqual(risenRows(ROWS, 2), ['hat', 'ears'])
  })

  test('is one row taller at each step, up to the whole buddy', () => {
    for (let shown = 0; shown <= ROWS.length + 1; shown++) {
      assert.equal(risenRows(ROWS, shown).length, Math.min(shown, ROWS.length), `shown ${shown}`)
    }
  })

  test('a negative count shows nothing', () => {
    assert.deepEqual(risenRows(ROWS, -1), [])
  })

  test('a whole buddy, or more rows asked than exist, is unchanged', () => {
    assert.deepEqual(risenRows(ROWS, ROWS.length), ROWS)
    assert.deepEqual(risenRows(ROWS, Infinity), ROWS)
  })

  test('works for a buddy drawn without its name', () => {
    assert.deepEqual(risenRows(ROWS.slice(0, 5), 1), ['hat'])
    assert.deepEqual(risenRows(ROWS.slice(0, 5), 9), ROWS.slice(0, 5))
  })
})

describe('nextRise', () => {
  test('climbs one row at a time and ends whole', () => {
    const seen: Array<number | null> = []
    for (let step: number | null = 0; step !== null; step = nextRise(step)) seen.push(step)
    assert.deepEqual(seen, [0, 1, 2, 3, 4, 5])
    assert.equal(nextRise(RISE_ROWS - 1), null)
  })

  test('is null when no rise is running', () => {
    assert.equal(nextRise(null), null)
  })
})

describe('clampRise', () => {
  test('passes a number from 0 up, and 0 means off', () => {
    assert.equal(clampRise(0), 0)
    assert.equal(clampRise(200), 200)
  })

  test('falls back to the default for anything else', () => {
    for (const bad of [undefined, null, '120', NaN, -1, Infinity]) {
      assert.equal(clampRise(bad), RISE_MS, String(bad))
    }
  })

  test('caps a long hold', () => {
    assert.equal(clampRise(60_000), RISE_MAX_MS)
  })
})
