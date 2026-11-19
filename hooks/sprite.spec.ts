import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REST_JITTER,
  SPRITE_WIDTH,
  bodyLines,
  clampCadence,
  holdMs,
  nameLine,
  nextPose,
  type Pose,
} from './sprite.ts'

/** An rng that always answers `v`. */
const always = (v: number) => () => v
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

test('a flick always settles back to rest, whatever the rng says', () => {
  for (const v of [0, 0.49, 0.5, 0.999]) {
    assert.equal(nextPose('tail', always(v)), 'rest')
    assert.equal(nextPose('ears', always(v)), 'rest')
  }
})

test('a rest flicks the tail or the ears at even odds', () => {
  assert.equal(nextPose('rest', always(0)), 'tail')
  assert.equal(nextPose('rest', always(0.4999)), 'tail')
  assert.equal(nextPose('rest', always(0.5)), 'ears')
  assert.equal(nextPose('rest', always(0.9999)), 'ears')
})

test('the same end can move twice running', () => {
  let pose: Pose = 'rest'
  const flicks: Pose[] = []
  for (let i = 0; i < 4; i += 1) {
    pose = nextPose(pose, always(0.1))
    if (pose !== 'rest') flicks.push(pose)
  }
  assert.deepEqual(flicks, ['tail', 'tail'])
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

test('rest is held far longer than a flick, even at its shortest', () => {
  const c = clampCadence(15000, 400)
  assert.ok(holdMs('rest', c, always(0)) > holdMs('tail', c, always(0)))
  assert.equal(holdMs('tail', c, always(0.7)), holdMs('ears', c, always(0.2)))
})

test('the default rest is 10 to 20 seconds; a flick is not jittered', () => {
  const c = clampCadence(undefined, undefined)
  assert.equal(REST_JITTER, 1 / 3)
  assert.equal(holdMs('rest', c, always(0)), 10000)
  assert.equal(holdMs('rest', c, always(0.5)), 15000)
  assert.ok(holdMs('rest', c, always(0.9999)) <= 20000)
  for (const v of [0, 0.5, 0.9999]) assert.equal(holdMs('tail', c, always(v)), 400)
})

test('a cadence too fast to read is clamped, and junk falls back', () => {
  assert.deepEqual(clampCadence(10, 1), { restMs: 1000, flickMs: 80 })
  assert.deepEqual(clampCadence(undefined, 'nope'), { restMs: 15000, flickMs: 400 })
  assert.deepEqual(clampCadence(NaN, Infinity), { restMs: 15000, flickMs: 400 })
})
