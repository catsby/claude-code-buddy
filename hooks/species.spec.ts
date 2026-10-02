import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BODIES,
  CAT_INSET,
  EYES,
  EYE_SLOT,
  HAT_LINES,
  SPECIES,
  SPECIES_WIDTH,
  frameCount,
  spriteLines,
  type Eye,
  type Hat,
} from './species.ts'
import { FRAME_OF_POSE, SPRITE_WIDTH, bodyLines, poseAt } from './sprite.ts'

const EYE: Eye = '✦'
const HATS = Object.keys(HAT_LINES) as Hat[]
const WEARABLE = HATS.filter((h) => h !== 'none')

test('the table is eighteen species of three frames of five rows', () => {
  assert.equal(SPECIES.length, 18)
  assert.equal(new Set(SPECIES).size, 18)
  for (const species of SPECIES) {
    assert.equal(frameCount(species), 3, species)
    for (const frame of BODIES[species]) assert.equal(frame.length, 5, species)
  }
})

test('every row is the table width once its eyes are filled in', () => {
  // The slot is three characters and the eye is one, so the stored rows are
  // only the right width after substitution. Checking the literals would pass
  // for the wrong reason on any row without an eye.
  for (const species of SPECIES) {
    for (const [i, frame] of BODIES[species].entries()) {
      for (const row of frame) {
        const filled = row.replaceAll(EYE_SLOT, EYE)
        assert.equal([...filled].length, SPECIES_WIDTH, `${species} frame ${i}: ${JSON.stringify(row)}`)
      }
    }
  }
})

test('every species has eyes, and they are on one row', () => {
  for (const species of SPECIES) {
    for (const frame of BODIES[species]) {
      const withEyes = frame.filter((row) => row.includes(EYE_SLOT))
      assert.equal(withEyes.length, 1, species)
    }
  }
})

test('the six eyes are distinct single cells', () => {
  assert.equal(EYES.length, 6)
  assert.equal(new Set(EYES).size, 6)
  for (const eye of EYES) assert.equal([...eye].length, 1, eye)
})

test('a wearable hat is the table width, and none is empty', () => {
  assert.equal(HAT_LINES.none, '')
  for (const hat of WEARABLE) {
    assert.equal([...HAT_LINES[hat]].length, SPECIES_WIDTH, hat)
    assert.ok(HAT_LINES[hat].trim().length > 0, hat)
  }
})

test('a rendered frame is five rows of the table width, with no slots left', () => {
  for (const species of SPECIES) {
    for (const hat of HATS) {
      for (let frame = 0; frame < frameCount(species); frame += 1) {
        const rows = spriteLines({ species, hat, eye: EYE }, frame)
        assert.equal(rows.length, 5, species)
        for (const row of rows) {
          assert.equal([...row].length, SPECIES_WIDTH, `${species}/${hat}/${frame}`)
          assert.ok(!row.includes(EYE_SLOT), `${species}/${hat}/${frame}`)
        }
      }
    }
  }
})

test('the hat lands on row 0, and yields to a species that is using it', () => {
  // Both branches are real: the cat leaves row 0 free in all three frames,
  // the dragon fills it with smoke in its third and so goes bare-headed.
  assert.equal(spriteLines({ species: 'cat', hat: 'crown', eye: EYE }, 0)[0], HAT_LINES.crown)
  assert.equal(spriteLines({ species: 'cat', hat: 'none', eye: EYE }, 0)[0], BODIES.cat[0]![0])

  const smoke = BODIES.dragon[2]![0]!
  assert.ok(smoke.trim().length > 0)
  assert.equal(spriteLines({ species: 'dragon', hat: 'crown', eye: EYE }, 2)[0], smoke)
})

test('frames wrap, in both directions', () => {
  const bones = { species: 'cat', hat: 'tophat', eye: EYE } as const
  assert.deepEqual(spriteLines(bones, 3), spriteLines(bones, 0))
  assert.deepEqual(spriteLines(bones, -1), spriteLines(bones, 2))
})

test('the vendored cat is the cat we measured off the recording', () => {
  // The one claim that matters: two independent readings of the same sprite,
  // ours off a screen recording and any-buddy's off the shipped build. The
  // table stores the cat inset two columns in a twelve-wide row; sprite.ts
  // stores the same eight columns with the tophat already baked into row 0.
  for (const pose of ['rest', 'tail', 'ears'] as const) {
    const vendored = spriteLines(
      { species: 'cat', hat: 'tophat', eye: EYE },
      FRAME_OF_POSE[pose],
    ).map((row) => row.slice(CAT_INSET, CAT_INSET + SPRITE_WIDTH))
    assert.deepEqual(bodyLines(pose), vendored, pose)
  }
})

test('the pose cycle picks frames the table actually has', () => {
  for (let step = 0; step < 8; step += 1) {
    assert.ok(['rest', 'tail', 'ears'].includes(poseAt(step)))
  }
})
