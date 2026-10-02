import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CYCLE,
  SPRITE_WIDTH,
  bodyLines,
  clampCadence,
  holdMs,
  nameLine,
  poseAt,
  type Pose,
} from './sprite.ts'
import { SPECIES_WIDTH } from './species.ts'

const POSES: Pose[] = ['rest', 'tail', 'ears']

test('the sprite is five rows, every one padded to a common width', () => {
  for (const pose of POSES) {
    const lines = bodyLines(pose)
    assert.equal(lines.length, 5)
    for (const line of lines) assert.equal(line.length, SPRITE_WIDTH)
  }
})

test('the hat sits directly over the ears', () => {
  const [hat, earRow] = bodyLines('rest')
  assert.equal(hat!.indexOf('['), earRow!.indexOf('/'))
})

test('the rest pose is the one read off the recording', () => {
  assert.deepEqual(
    bodyLines('rest').map(l => l.trimEnd()),
    [' [___]', ' /\\_/\\', '( ✦   ✦)', '(  ω  )', '(")_(")'],
  )
})

test('a flick moves one row and leaves the rest alone', () => {
  const rest = bodyLines('rest')
  for (const pose of ['tail', 'ears'] as const) {
    const moved = bodyLines(pose).map((l, i) => l !== rest[i]!).filter(Boolean)
    assert.equal(moved.length, 1, `${pose} should move exactly one row`)
  }
  assert.equal(bodyLines('ears')[1]!.trim(), '/\\-/\\')
  assert.equal(bodyLines('tail')[4]!.trim(), '(")_(")~')
})

test('the tail flick still fits the block', () => {
  assert.ok('(")_(")~'.length <= SPRITE_WIDTH)
})

test('the cycle rests between flicks and alternates which end moves', () => {
  assert.deepEqual([...CYCLE], ['rest', 'tail', 'rest', 'ears'])
  assert.deepEqual([0, 1, 2, 3, 4].map(poseAt), ['rest', 'tail', 'rest', 'ears', 'rest'])
})

test('the pose cycle never falls off either end', () => {
  assert.equal(poseAt(-1), 'ears')
  assert.equal(poseAt(Number.MAX_SAFE_INTEGER), poseAt(Number.MAX_SAFE_INTEGER % 4))
})

test('the name row is as wide as a table row, and starts under the cat', () => {
  assert.equal(nameLine('Gristle'), '  Gristle   ')
  assert.equal(nameLine('Gristle').length, SPECIES_WIDTH)
})

test('a long name gives up the inset before any letters, and is cut past the row', () => {
  assert.equal(nameLine('Bartholomew'), ' Bartholomew')
  assert.equal(nameLine('Maximiliano!'), 'Maximiliano!')
  assert.equal(nameLine('Wolfeschlegelstein'), 'Wolfeschlege')
})

test('rest is held far longer than a flick', () => {
  const c = clampCadence(2600, 400)
  assert.ok(holdMs('rest', c) > holdMs('tail', c))
  assert.equal(holdMs('tail', c), holdMs('ears', c))
})

test('a cadence too fast to read is clamped, and junk falls back', () => {
  assert.deepEqual(clampCadence(10, 1), { restMs: 1000, flickMs: 80 })
  assert.deepEqual(clampCadence(undefined, 'nope'), { restMs: 2600, flickMs: 400 })
  assert.deepEqual(clampCadence(NaN, Infinity), { restMs: 2600, flickMs: 400 })
})
