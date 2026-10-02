import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CAT_INSET, SPECIES_WIDTH } from './species.ts'
import {
  HEART_STEPS,
  heartHoldMs,
  heartRow,
} from './hearts.ts'

const STEPS = [...Array(HEART_STEPS).keys()]
/** Where cat column `col` lands in the row. */
const at = (row: string, col: number) => row[col + CAT_INSET]

test('the widest reach, two left and one past the cat, fits the table row', () => {
  assert.ok(-2 + CAT_INSET >= 0)
  assert.ok(8 + CAT_INSET < SPECIES_WIDTH)
})

test('every state fills the row to a common width', () => {
  for (const step of STEPS) {
    assert.equal(heartRow(step)!.length, SPECIES_WIDTH, `step ${step}`)
  }
})

test('three hearts in every state, as in every frame of the recording', () => {
  for (const step of STEPS) {
    const drawn = [...heartRow(step)!].filter(c => c !== ' ')
    assert.equal(drawn.length, 3, `step ${step}`)
  }
})

test('the hearts drift outward, reaching a column past the sprite each side', () => {
  // Widest state is the third: columns -2, 1 and 8.
  assert.notEqual(at(heartRow(2)!, -2), ' ')
  assert.notEqual(at(heartRow(2)!, 8), ' ')
  // The first state is the narrowest, and sits inside the sprite.
  assert.notEqual(at(heartRow(0)!, 0), ' ')
  assert.notEqual(at(heartRow(0)!, 7), ' ')
})

test('no two states are the same', () => {
  const rows = STEPS.map(heartRow)
  assert.equal(new Set(rows).size, rows.length)
})

test('the hearts fade to dots in the last state only', () => {
  for (const step of STEPS.slice(0, -1)) {
    assert.ok(heartRow(step)!.includes('♡'), `step ${step}`)
    assert.ok(!heartRow(step)!.includes('·'), `step ${step}`)
  }
  const last = heartRow(HEART_STEPS - 1)!
  assert.ok(last.includes('·'))
  assert.ok(!last.includes('♡'))
})

test('the row goes away once the states run out', () => {
  assert.equal(heartRow(HEART_STEPS), null)
  assert.equal(heartHoldMs(HEART_STEPS), 0)
})

test('the states are held on an even beat, near half a second each', () => {
  for (const step of STEPS) {
    const held = heartHoldMs(step)
    assert.ok(held >= 500 && held <= 525, `step ${step} held ${held}ms`)
  }
})

test('a pet runs about as long as the recording shows', () => {
  const total = STEPS.reduce((sum, step) => sum + heartHoldMs(step), 0)
  // 2.06s measured; the clear lands in (3.800, 4.315], so a touch more.
  assert.ok(total > 2000 && total < 2150, `total ${total}ms`)
})

test('nothing is drawn outside the row', () => {
  const rightmost = SPECIES_WIDTH - 1 - CAT_INSET
  for (const step of STEPS) {
    const row = heartRow(step)!
    assert.notEqual(at(row, rightmost), undefined, `step ${step}`)
    assert.equal(row.length === SPECIES_WIDTH, true, `step ${step}`)
  }
})
