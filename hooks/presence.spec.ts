import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  ARRIVE_AFTER,
  FAIL_LIMIT,
  START,
  focusedBlock,
  isFocused,
  stepFailures,
  stepPresence,
} from './presence.ts'

const view = (active: string, windows: Array<[string, string]>) =>
  JSON.stringify({
    active_window_id: active,
    windows: windows.map(([window_id, focused_block_id]) => ({ window_id, focused_block_id })),
  })

const TABS = view('w2', [
  ['w1', 'b1'],
  ['w2', 'b2'],
  ['w3', 'b3'],
])

describe('focusedBlock', () => {
  test('is the focused block of the active window only', () => {
    assert.equal(focusedBlock(JSON.parse(TABS)), 'b2')
  })

  test('is unknown for any other shape', () => {
    for (const bad of [null, 3, 'x', [], {}, { active_window_id: 'w1' }, { windows: [] }]) {
      assert.equal(focusedBlock(bad), undefined, JSON.stringify(bad))
    }
    assert.equal(focusedBlock(JSON.parse(view('w9', [['w1', 'b1']]))), undefined, 'no such window')
    assert.equal(
      focusedBlock({ active_window_id: 'w1', windows: [{ window_id: 'w1' }] }),
      undefined,
      'a window with nothing focused',
    )
  })
})

describe('isFocused', () => {
  test('is true for the focused pane and false for every other pane', () => {
    assert.equal(isFocused(TABS, 'b2'), true)
    assert.equal(isFocused(TABS, 'b1'), false, 'a pane in a tab that is not active')
    assert.equal(isFocused(TABS, 'b-elsewhere'), false)
  })

  test('is unknown when the text is not the inspect output', () => {
    assert.equal(isFocused('', 'b2'), undefined)
    assert.equal(isFocused('Error: no such session', 'b2'), undefined)
    assert.equal(isFocused('{}', 'b2'), undefined)
  })

  test('ignores fields it does not read', () => {
    const extra = JSON.stringify({ ...JSON.parse(TABS), revision: 9, clients: [] })
    assert.equal(isFocused(extra, 'b2'), true)
  })
})

describe('stepPresence', () => {
  test('starts shown', () => {
    assert.equal(START.here, true)
  })

  test('leaves on the first unfocused poll', () => {
    assert.deepEqual(stepPresence(START, false), { here: false, streak: 0 })
  })

  test('returns only after ARRIVE_AFTER focused polls in a row', () => {
    let state = stepPresence(START, false)
    for (let poll = 1; poll < ARRIVE_AFTER; poll++) {
      state = stepPresence(state, true)
      assert.equal(state.here, false, `poll ${poll}`)
    }
    assert.equal(stepPresence(state, true).here, true)
  })

  test('a pass through the tab that does not hold resets the count', () => {
    let state = stepPresence(START, false)
    state = stepPresence(state, true)
    state = stepPresence(state, false)
    assert.deepEqual(state, { here: false, streak: 0 })
    assert.equal(stepPresence(state, true).here, false)
  })

  test('an unknown answer changes nothing, shown or away', () => {
    assert.equal(stepPresence(START, undefined), START)
    const away = stepPresence(START, false)
    assert.equal(stepPresence(away, undefined), away)
  })

  test('a shown buddy stays shown while focused', () => {
    assert.deepEqual(stepPresence(START, true), START)
  })
})

describe('stepFailures', () => {
  test('counts polls with no answer in a row and resets on any answer', () => {
    let failures = 0
    for (let poll = 1; poll <= FAIL_LIMIT; poll++) {
      failures = stepFailures(failures, undefined)
      assert.equal(failures, poll)
    }
    assert.equal(stepFailures(failures, true), 0)
    assert.equal(stepFailures(failures, false), 0, 'an answer of away is still an answer')
  })
})
