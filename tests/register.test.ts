import { describe, expect, mock, test as kitTest } from 'claude-code/testing'

import { HEART_STEPS, heartHoldMs, heartRow } from '../hooks/hearts.ts'
import { ARRIVE_AFTER, FAIL_LIMIT, POLL_MS } from '../hooks/presence.ts'
import { RISE_MS, RISE_ROWS, risenRows } from '../hooks/rise.ts'
import { GRISTLE, bonesOf, identityFrom } from '../hooks/identity.ts'
import { SPECIES_WIDTH, spriteLines } from '../hooks/species.ts'
import { FRAME_OF_POSE, nameLine, type Pose } from '../hooks/sprite.ts'
import Fixtures from './fixtures/index.ts'

/**
 * Every test but the rise's own runs with the rise off, so a buddy is whole at
 * its first draw; the rise tests use `kitTest` and the manifest's hold.
 */
const STILL = { options: { riseMs: 0 } }
const test: typeof kitTest = (name, ...rest) =>
  rest.length === 1
    ? kitTest(name, STILL, rest[0])
    : kitTest(name, { ...rest[0], options: { ...STILL.options, ...rest[0].options } }, rest[1])

const ENGINE = 'engine band'
/** Gristle in a pose, as the band draws the cat. */
const bodyLines = (pose: Pose) =>
  spriteLines({ species: 'cat', hat: 'tophat', eye: '✦' }, FRAME_OF_POSE[pose])
const REST = [...bodyLines('rest'), nameLine('Gristle'), ENGINE]

describe('register', () => {
  test('the session start registers /buddy', async ($, on) => {
    const { clock, registered } = Fixtures.beneathBuddy(on)

    await $.session.start(Fixtures.SESSION)
    await clock.settle()

    expect(registered).toEqual(['buddy'])
  })

  test('Gristle sits above the engine band, which still draws', async ($, on) => {
    const { clock } = Fixtures.beneathBuddy(on)
    await $.session.start(Fixtures.SESSION)
    await clock.settle()

    const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

    expect(await Fixtures.rowsOf(ui)).toEqual(REST)
  })

  test('the poses follow the clock: rest, tail, rest, ears', async ($, on) => {
    const { clock } = Fixtures.beneathBuddy(on)
    await $.session.start(Fixtures.SESSION)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

    await clock.advance(2600)
    expect((await Fixtures.rowsOf(ui)).slice(0, 5)).toEqual(bodyLines('tail'))
    await clock.advance(400)
    expect((await Fixtures.rowsOf(ui)).slice(0, 5)).toEqual(bodyLines('rest'))
    await clock.advance(2600)
    expect((await Fixtures.rowsOf(ui)).slice(0, 5)).toEqual(bodyLines('ears'))
  })

  test('restMs from /config sets the rest', { options: { restMs: 1500 } }, async ($, on) => {
    const { clock } = Fixtures.beneathBuddy(on)
    await $.session.start(Fixtures.SESSION)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

    await clock.advance(1499)
    expect((await Fixtures.rowsOf(ui)).slice(0, 5)).toEqual(bodyLines('rest'))
    await clock.advance(1)
    expect((await Fixtures.rowsOf(ui)).slice(0, 5)).toEqual(bodyLines('tail'))
  })

  test('/buddy off yields the band and remembers; /buddy on undoes both', async ($, on) => {
    const { clock, store } = Fixtures.beneathBuddy(on)
    await $.session.start(Fixtures.SESSION)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

    const off = await $.command.run(Fixtures.buddy('off'))
    expect(off.text).toBe('Gristle wanders off. /buddy on brings Gristle back.')
    expect(store.get('hidden')).toBe(true)
    expect(await Fixtures.rowsOf(ui)).toEqual([ENGINE])

    const back = await $.command.run(Fixtures.buddy('on'))
    expect(back.text).toBe('Gristle pads back in.')
    expect(store.get('hidden')).toBe(false)
    expect(await Fixtures.rowsOf(ui)).toEqual(REST)

    expect((await $.command.run(Fixtures.buddy(''))).text).toBe('Gristle is already here.')
  })

  test('/buddy says so when the person has collapsed the band', async ($, on) => {
    const { clock } = Fixtures.beneathBuddy(on)
    await $.session.start(Fixtures.SESSION)
    await clock.settle()
    const collapsed = { ...Fixtures.BAND, props: { ...Fixtures.BAND.props, isCollapsed: true } }
    await $.ui.mount({ plugin: 'buddy', ...collapsed })

    const text = 'Gristle is here, but the band is collapsed. Press ctrl+x ctrl+a, or click the line above the prompt, to show it.'
    expect((await $.command.run(Fixtures.buddy('on'))).text).toBe(text)
    expect((await $.command.run(Fixtures.buddy('band'))).text).toBe(text)
  })

  test('a stored off holds from the first draw', async ($, on) => {
    const { clock } = Fixtures.beneathBuddy(on, { hidden: true })
    await $.session.start(Fixtures.SESSION)
    await clock.settle()

    const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

    expect(await Fixtures.rowsOf(ui)).toEqual([ENGINE])
  })

  test('/buddy pet floats the four heart states, then clears', async ($, on) => {
    const { clock, store } = Fixtures.beneathBuddy(on)
    await $.session.start(Fixtures.SESSION)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

    const pet = await $.command.run(Fixtures.buddy('pet'))
    expect(pet.text).toBe('petted Gristle')

    for (let step = 0; step < HEART_STEPS; step++) {
      const rows = await Fixtures.rowsOf(ui)
      expect(rows[0], `heart state ${step}`).toBe(heartRow(step))
      expect(rows.slice(1)).toEqual(REST)
      await clock.advance(heartHoldMs(step))
    }

    expect(await Fixtures.rowsOf(ui)).toEqual(REST)
    expect([...store.keys()], 'a pet persists nothing').toEqual([])
  })

  test('the sprite keeps its column across a pet', async ($, on) => {
    const { clock } = Fixtures.beneathBuddy(on)
    await $.session.start(Fixtures.SESSION)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })
    const boxes = async () => (await ui.findAll({ type: 'Box' })).map((b) => b.props)
    const ours = async () => (await Fixtures.rowsOf(ui)).filter((row) => row !== ENGINE)

    const before = await boxes()
    await $.command.run(Fixtures.buddy('pet'))

    // The column is right-aligned as a block, so it holds still exactly when
    // the layout is untouched and every row, hearts included, is one width.
    expect(await boxes()).toEqual(before)
    const rows = await ours()
    expect(rows).toEqual([heartRow(0), ...REST.filter((row) => row !== ENGINE)])
    for (const row of rows) expect(row, JSON.stringify(row)).toHaveLength(SPECIES_WIDTH)
  })

  test('there is no one to pet while the buddy is away', async ($, on) => {
    const { clock } = Fixtures.beneathBuddy(on, { hidden: true })
    await $.session.start(Fixtures.SESSION)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

    const pet = await $.command.run(Fixtures.buddy('pet'))

    expect(pet.text).toBe('Gristle is not here. /buddy on brings Gristle back.')
    expect(await Fixtures.rowsOf(ui)).toEqual([ENGINE])
  })

  test('/buddy off mid-pet ends it', async ($, on) => {
    const { clock } = Fixtures.beneathBuddy(on)
    await $.session.start(Fixtures.SESSION)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

    await $.command.run(Fixtures.buddy('pet'))
    await $.command.run(Fixtures.buddy('off'))
    await $.command.run(Fixtures.buddy('on'))

    expect(await Fixtures.rowsOf(ui)).toEqual(REST)
  })

  test('an unknown verb gets the usage line', async ($, on) => {
    const { clock } = Fixtures.beneathBuddy(on)
    await $.session.start(Fixtures.SESSION)
    await clock.settle()

    const { text } = await $.command.run(Fixtures.buddy('Fetch'))

    expect(text).toBe('/buddy takes on, off, pet, pane, band, name <name>, roll or roll back (got "Fetch").')
  })

  describe('the side pane', () => {
    /** The pane calls a plugin makes, and whether the terminal places it. */
    const beneathPane = (on: Parameters<typeof Fixtures.beneathBuddy>[0], isPlaced: boolean) => {
      const world = Fixtures.beneathBuddy(on)
      const opened: { id: string; columns?: number }[] = []
      const closed: string[] = []
      on('ui.open', ($, e) => {
        opened.push(e)
        return { value: isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'narrow' } }
      })
      on('ui.close', ($, e) => {
        closed.push(e.id)
        return { value: undefined }
      })
      return { ...world, opened, closed }
    }

    test('/buddy pane opens the pane, remembers, and yields the band', async ($, on) => {
      const { clock, store, opened } = beneathPane(on, true)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const band = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      const { text } = await $.command.run(Fixtures.buddy('pane'))

      expect(text).toBe('Gristle moves to the side.')
      expect(opened).toEqual([{ id: 'buddy', title: 'Gristle', columns: SPECIES_WIDTH + 2 }])
      expect(store.get('layout')).toBe('pane')
      expect(await Fixtures.rowsOf(band)).toEqual([ENGINE])
    })

    test('the docked pane draws the sprite and name, and no engine row', async ($, on) => {
      const { clock } = beneathPane(on, true)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      await $.command.run(Fixtures.buddy('pane'))

      const pane = await $.ui.mount({ plugin: 'buddy', ...Fixtures.PANE })

      expect(await Fixtures.rowsOf(pane)).toEqual([...bodyLines('rest'), nameLine('Gristle')])
    })

    test('a terminal too narrow to dock keeps the buddy in the band', async ($, on) => {
      const { clock, store } = beneathPane(on, false)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const band = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      const { text } = await $.command.run(Fixtures.buddy('pane'))

      expect(text).toContain('stays in the band')
      expect(store.get('layout')).toBe('pane')
      expect(await Fixtures.rowsOf(band)).toEqual(REST)
    })

    test('/buddy band closes the pane and the band draws again', async ($, on) => {
      const { clock, store, closed } = beneathPane(on, true)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const band = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })
      await $.command.run(Fixtures.buddy('pane'))

      const { text } = await $.command.run(Fixtures.buddy('band'))

      expect(text).toBe('Gristle is back above the prompt.')
      expect(closed).toEqual(['buddy'])
      expect(store.get('layout')).toBe('band')
      expect(await Fixtures.rowsOf(band)).toEqual(REST)
    })

    test('/buddy off closes the pane and /buddy on opens it again', async ($, on) => {
      const { clock, opened, closed } = beneathPane(on, true)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      await $.command.run(Fixtures.buddy('pane'))

      await $.command.run(Fixtures.buddy('off'))
      expect(closed).toEqual(['buddy'])

      await $.command.run(Fixtures.buddy('on'))
      expect(opened).toHaveLength(2)
    })

    test('a pane that comes up inline is closed for the band', async ($, on) => {
      const { clock, closed } = beneathPane(on, true)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      await $.command.run(Fixtures.buddy('pane'))

      await $.ui.mount({
        plugin: 'buddy',
        ...Fixtures.PANE,
        props: { ...Fixtures.PANE.props, placement: 'inline' },
      })
      await clock.advance(1)

      expect(closed).toEqual(['buddy'])
    })

    test('a stored pane layout reopens the pane when the session starts', async ($, on) => {
      const world = Fixtures.beneathBuddy(on, { layout: 'pane' })
      const opened: string[] = []
      on('ui.open', ($, e) => {
        opened.push(e.id)
        return { value: { isPlaced: true } }
      })
      on('ui.panes', () => ({ value: [] }))
      on('ui.close', () => ({ value: undefined }))

      await $.session.start(Fixtures.SESSION)
      await world.clock.settle()

      expect(opened).toEqual(['buddy'])
    })
  })

  describe('the band is yielded', () => {
    const yields = {
      'to a survey': { hasSurvey: true },
      'when too short for the sprite': { maxRows: 5 },
      'when too narrow for the sprite': { bodyColumns: SPECIES_WIDTH - 1 },
    }
    for (const [when, props] of Object.entries(yields)) {
      test(when, async ($, on) => {
        const { clock } = Fixtures.beneathBuddy(on)
        await $.session.start(Fixtures.SESSION)
        await clock.settle()

        const ui = await $.ui.mount({
          plugin: 'buddy',
          ...Fixtures.BAND,
          props: { ...Fixtures.BAND.props, ...props },
        })

        expect(await Fixtures.rowsOf(ui)).toEqual([ENGINE])
      })
    }

    test('off the terminal', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()

      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND, surface: 'desktop' })

      expect(await Fixtures.rowsOf(ui)).toEqual([ENGINE])
    })
  })

  test('at exactly the sprite width, it draws', async ($, on) => {
    const { clock } = Fixtures.beneathBuddy(on)
    await $.session.start(Fixtures.SESSION)
    await clock.settle()

    const ui = await $.ui.mount({
      plugin: 'buddy',
      ...Fixtures.BAND,
      props: { ...Fixtures.BAND.props, bodyColumns: SPECIES_WIDTH, maxRows: 6 },
    })

    expect(await Fixtures.rowsOf(ui)).toEqual(REST)
  })

  test('a pet in six rows keeps the sprite and drops the hearts', async ($, on) => {
    const { clock } = Fixtures.beneathBuddy(on)
    await $.session.start(Fixtures.SESSION)
    await clock.settle()
    const ui = await $.ui.mount({
      plugin: 'buddy',
      ...Fixtures.BAND,
      props: { ...Fixtures.BAND.props, maxRows: 6 },
    })

    await $.command.run(Fixtures.buddy('pet'))

    expect(await Fixtures.rowsOf(ui)).toEqual(REST)
  })

  describe('identity', () => {
    const QUILL = { species: 'duck', hat: 'wizard', eye: '◉', name: 'Quill', color: '#ffcc00' }

    test('a stored buddy is the one drawn, by name', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on, { identity: QUILL })
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      expect(await Fixtures.rowsOf(ui)).toEqual([
        ...spriteLines({ species: 'duck', hat: 'wizard', eye: '◉' }, 0),
        nameLine('Quill'),
        ENGINE,
      ])
      expect((await $.command.run(Fixtures.buddy('pet'))).text).toBe('petted Quill')
    })

    test('a stored color outranks the /config one', { options: { color: 'red' } }, async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on, { identity: QUILL })
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      const hat = await ui.find({ type: 'Text', text: spriteLines({ species: 'duck', hat: 'wizard', eye: '◉' }, 0)[0]! })
      expect(hat?.props.color).toBe('#ffcc00')
    })

    test('with no stored color, /config decides', { options: { color: 'red' } }, async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      const hat = await ui.find({ type: 'Text', text: bodyLines('rest')[0]! })
      expect(hat?.props.color).toBe('red')
    })

    test('a species the table does not know draws the cat, keeping the rest', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on, { identity: { ...QUILL, species: 'dog' } })
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      expect((await Fixtures.rowsOf(ui)).slice(0, 5)).toEqual(
        spriteLines({ species: 'cat', hat: 'wizard', eye: '◉' }, 0),
      )
    })
  })

  describe('name', () => {
    const MOCHI = { species: 'owl', hat: 'halo', eye: '·', name: 'Mochi', color: '#88ccff' }

    test('renames the buddy, keeping every other field and the case typed', async ($, on) => {
      const { clock, store } = Fixtures.beneathBuddy(on, { identity: MOCHI, previous: GRISTLE })
      await $.session.start(Fixtures.SESSION)
      await clock.settle()

      const { text } = await $.command.run(Fixtures.buddy('name  Sir Whiskers '))

      expect(store.get('identity')).toEqual({ ...MOCHI, name: 'Sir Whiskers' })
      expect(store.get('previous')).toEqual(GRISTLE)
      expect(text).toBe('Mochi is now called Sir Whiskers.')
    })

    test('blank and over-long names are rejected and nothing is written', async ($, on) => {
      const { clock, store } = Fixtures.beneathBuddy(on, { identity: MOCHI })
      await $.session.start(Fixtures.SESSION)
      await clock.settle()

      for (const args of ['name', 'name   ', 'name Wolfeschlegelstein']) {
        const { text } = await $.command.run(Fixtures.buddy(args))
        expect(text).toContain('A name is 1 to 12 characters')
        expect(text).toContain('Mochi keeps the name.')
      }
      expect(store.get('identity')).toEqual(MOCHI)
    })

    test('a rename survives a roll', async ($, on) => {
      const { clock, store } = Fixtures.beneathBuddy(on, { identity: MOCHI })
      await $.session.start(Fixtures.SESSION)
      await clock.settle()

      await $.command.run(Fixtures.buddy('name Pip'))
      await $.command.run(Fixtures.buddy('roll'))

      expect(identityFrom(store.get('identity')).name).toBe('Pip')
    })
  })

  describe('roll', () => {
    const MOCHI = { species: 'owl', hat: 'halo', eye: '·', name: 'Mochi', color: '#88ccff' }

    test('rolls new looks, keeps the name and color, and saves the old buddy', async ($, on) => {
      const { clock, store } = Fixtures.beneathBuddy(on, { identity: MOCHI })
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      const { text } = await $.command.run(Fixtures.buddy('roll'))

      const now = identityFrom(store.get('identity'))
      expect(now.name).toBe('Mochi')
      expect(now.color).toBe('#88ccff')
      expect('rarity' in now).toBe(false)
      expect(store.get('previous')).toEqual(MOCHI)
      expect(text).toMatch(/^Mochi is now an? (common|uncommon|rare|epic|legendary) /)
      expect(text).toMatch(/\. \/buddy roll back undoes it\.$/)
      expect((await Fixtures.rowsOf(ui)).slice(0, 5)).toEqual(spriteLines(bonesOf(now), 0))
    })

    test('a common roll is hatless', async ($, on) => {
      // Math.random is the plugin's; roll until a common comes up, which is
      // 60% a roll, so a handful always does.
      const { clock, store } = Fixtures.beneathBuddy(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()

      let seen = 0
      for (let i = 0; i < 40; i++) {
        const { text } = await $.command.run(Fixtures.buddy('roll'))
        const now = identityFrom(store.get('identity'))
        if (text?.includes(' is now a common ')) {
          seen += 1
          expect(now.hat).toBe('none')
        }
      }
      expect(seen).toBeGreaterThan(0)
    })

    test('roll back restores the buddy before the roll, once', async ($, on) => {
      const { clock, store } = Fixtures.beneathBuddy(on, { identity: MOCHI })
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      await $.command.run(Fixtures.buddy('roll'))
      const back = await $.command.run(Fixtures.buddy('roll  BACK'))

      expect(back.text).toBe('Mochi is back as before.')
      expect(store.get('identity')).toEqual(MOCHI)
      expect(store.has('previous')).toBe(false)
      expect((await Fixtures.rowsOf(ui)).slice(0, 5)).toEqual(
        spriteLines({ species: 'owl', hat: 'halo', eye: '·' }, 0),
      )
      expect((await $.command.run(Fixtures.buddy('roll back'))).text).toBe('Nothing to roll back to.')
    })

    test('Gristle can be rolled away and back', async ($, on) => {
      const { clock, store } = Fixtures.beneathBuddy(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()

      await $.command.run(Fixtures.buddy('roll'))
      await $.command.run(Fixtures.buddy('roll back'))

      expect(identityFrom(store.get('identity'))).toEqual(GRISTLE)
    })

    test('with no roll yet, there is nothing to roll back to', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()

      expect((await $.command.run(Fixtures.buddy('roll back'))).text).toBe('Nothing to roll back to.')
    })
  })

  describe('following the person in Rex', () => {
    const OTHER = 'block:elsewhere'
    const gone = [ENGINE]

    test('outside Rex nothing is run and the buddy stays', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      const calls: string[][] = []
      mock.env(on, {})
      on('process.run', ($, e) => {
        calls.push([...e.argv])
        return { deny: 'not in Rex' }
      })
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      await clock.advance(POLL_MS * 3)

      expect(calls).toEqual([])
      expect(await Fixtures.rowsOf(ui)).toEqual(REST)
    })

    test('asks Rex about its own session, as JSON', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      const { calls } = Fixtures.rexFocus(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()

      expect(calls[0]).toEqual(['rex', 'session', 'inspect', Fixtures.REX_SESSION, '--json'])
    })

    test('stays while its pane is focused', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      Fixtures.rexFocus(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      await clock.advance(POLL_MS * 3)

      expect(await Fixtures.rowsOf(ui)).toEqual(REST)
    })

    test('leaves on the next poll after the focus moves, and returns after a moment', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      const { state } = Fixtures.rexFocus(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      state.focused = OTHER
      await clock.advance(POLL_MS)
      expect(await Fixtures.rowsOf(ui)).toEqual(gone)

      state.focused = Fixtures.REX_BLOCK
      for (let poll = 1; poll < ARRIVE_AFTER; poll++) {
        await clock.advance(POLL_MS)
        expect(await Fixtures.rowsOf(ui), `poll ${poll}`).toEqual(gone)
      }
      await clock.advance(POLL_MS)
      expect(await Fixtures.rowsOf(ui)).toEqual(REST)
    })

    test('a failing rex never hides the buddy', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      const { state } = Fixtures.rexFocus(on)
      state.fails = true
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      await clock.advance(POLL_MS * 3)

      expect(await Fixtures.rowsOf(ui)).toEqual(REST)
    })

    test('a failing rex is asked FAIL_LIMIT times, then left alone', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      const { state, calls } = Fixtures.rexFocus(on)
      state.fails = true
      await $.session.start(Fixtures.SESSION)
      await clock.settle()

      await clock.advance(POLL_MS * (FAIL_LIMIT + 5))

      expect(calls).toHaveLength(FAIL_LIMIT)
    })

    test('an answer in between resets the count', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      const { state, calls } = Fixtures.rexFocus(on)
      state.fails = true
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      // FAIL_LIMIT - 1 failures so far (the settle's poll and the ones after it).
      await clock.advance(POLL_MS * (FAIL_LIMIT - 2))
      state.fails = false
      await clock.advance(POLL_MS)
      state.fails = true

      await clock.advance(POLL_MS * (FAIL_LIMIT + 5))

      // The answer reset the count, so it took FAIL_LIMIT more failures to stop.
      expect(calls).toHaveLength(FAIL_LIMIT - 1 + 1 + FAIL_LIMIT)
    })

    test('a failing rex leaves an away buddy away until it gives up, then shows it', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      const { state } = Fixtures.rexFocus(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })
      await clock.advance(RISE_MS * RISE_ROWS)
      state.focused = OTHER
      await clock.advance(POLL_MS)
      expect(await Fixtures.rowsOf(ui)).toEqual([ENGINE])

      state.fails = true
      await clock.advance(POLL_MS * (FAIL_LIMIT - 1))
      expect(await Fixtures.rowsOf(ui), 'still away before the limit').toEqual([ENGINE])

      await clock.advance(POLL_MS)
      await clock.advance(RISE_MS * RISE_ROWS)
      expect(await Fixtures.rowsOf(ui)).toEqual(REST)
    })

    test('/buddy off holds whatever Rex says, and writes nothing for presence', async ($, on) => {
      const { clock, store } = Fixtures.beneathBuddy(on)
      const { state } = Fixtures.rexFocus(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })
      await $.command.run(Fixtures.buddy('off'))

      state.focused = OTHER
      await clock.advance(POLL_MS)
      state.focused = Fixtures.REX_BLOCK
      await clock.advance(POLL_MS * (ARRIVE_AFTER + 1))

      expect(await Fixtures.rowsOf(ui)).toEqual(gone)
      expect([...store.keys()], 'only the off').toEqual(['hidden'])
    })
  })

  describe('rising into view', () => {
    const test = kitTest
    /** The band `shown` rows into the rise: that many of the buddy's six rows, then the engine's. */
    const risen = (shown: number) => [...risenRows(REST.slice(0, RISE_ROWS), shown), ENGINE]

    /** Steps the rise one row at a time, asserting each frame, to a whole buddy. */
    const climb = async (
      clock: { advance: (ms: number) => Promise<void> },
      ui: Parameters<typeof Fixtures.rowsOf>[0],
    ) => {
      for (let shown = 1; shown < RISE_ROWS; shown++) {
        await clock.advance(RISE_MS)
        expect(await Fixtures.rowsOf(ui), `${shown} rows`).toEqual(risen(shown))
      }
      await clock.advance(RISE_MS)
      expect(await Fixtures.rowsOf(ui)).toEqual(REST)
    }

    test('a new session starts with no rows and fills in from the top', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      expect(await Fixtures.rowsOf(ui)).toEqual(risen(0))
      await climb(clock, ui)
    })

    test('the crown draws first, alone, and each row after it is added below', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      await clock.advance(RISE_MS)
      expect(await Fixtures.rowsOf(ui)).toEqual([REST[0], ENGINE])
      await clock.advance(RISE_MS)
      expect(await Fixtures.rowsOf(ui)).toEqual([REST[0], REST[1], ENGINE])
    })

    test('the band grows by one row at each step, then stops', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      for (let step = 0; step <= RISE_ROWS; step++) {
        expect(await Fixtures.rowsOf(ui), `step ${step}`).toHaveLength(1 + Math.min(step, RISE_ROWS))
        await clock.advance(RISE_MS)
      }
      await clock.advance(RISE_MS * 3)
      expect(await Fixtures.rowsOf(ui)).toHaveLength(REST.length)
    })

    test('/buddy on after /buddy off rises again', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })
      await clock.advance(RISE_MS * RISE_ROWS)
      await $.command.run(Fixtures.buddy('off'))

      await $.command.run(Fixtures.buddy('on'))

      expect(await Fixtures.rowsOf(ui)).toEqual(risen(0))
      await climb(clock, ui)
    })

    test('/buddy off during a rise stops it', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })
      await clock.advance(RISE_MS * 2)

      await $.command.run(Fixtures.buddy('off'))
      await clock.advance(RISE_MS * RISE_ROWS)

      expect(await Fixtures.rowsOf(ui)).toEqual([ENGINE])
    })

    test('a stored off does not rise', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on, { hidden: true })
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      await clock.advance(RISE_MS * RISE_ROWS)

      expect(await Fixtures.rowsOf(ui)).toEqual([ENGINE])
    })

    test('coming back to a pane in Rex rises, it does not just appear', async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      const { state } = Fixtures.rexFocus(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })
      await clock.advance(RISE_MS * RISE_ROWS)
      state.focused = 'block:elsewhere'
      await clock.advance(POLL_MS)
      expect(await Fixtures.rowsOf(ui)).toEqual([ENGINE])

      // The polls are on a two second beat from the start: the next is at 2 * POLL_MS.
      state.focused = Fixtures.REX_BLOCK
      const elapsed = RISE_MS * RISE_ROWS + POLL_MS
      await clock.advance(POLL_MS * (ARRIVE_AFTER + 1) - elapsed)

      expect(await Fixtures.rowsOf(ui)).toEqual(risen(0))
      await climb(clock, ui)
    })

    test('riseMs 0 draws the whole buddy at once', { options: { riseMs: 0 } }, async ($, on) => {
      const { clock } = Fixtures.beneathBuddy(on)
      await $.session.start(Fixtures.SESSION)
      await clock.settle()
      const ui = await $.ui.mount({ plugin: 'buddy', ...Fixtures.BAND })

      expect(await Fixtures.rowsOf(ui)).toEqual(REST)
    })
  })
})
