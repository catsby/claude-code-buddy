import type { EngineInterface, Register, Timer } from 'claude-code'
import {
  FRAME_OF_POSE,
  clampCadence,
  holdMs,
  nameLine,
  poseAt,
  type Cadence,
} from './sprite.ts'
import { HEART_STEPS, heartHoldMs, heartRow } from './hearts.ts'
import { SPECIES_WIDTH, spriteLines } from './species.ts'
import {
  GRISTLE,
  IDENTITY_KEY,
  NAME_MAX,
  PREVIOUS_KEY,
  bonesOf,
  cleanName,
  identityFrom,
  type Identity,
} from './identity.ts'
import { describe, roll } from './roll.ts'

/**
 * The pane's id, and the store key for where the buddy lives. 'band' is the
 * strip above the prompt; 'pane' is the docked sidebar, which costs width
 * instead of rows. Only a docked pane yields the band: an inline one (a narrow
 * terminal) is a framed region above the prompt, no better than the band.
 */
const PANE = 'buddy'
const LAYOUT_KEY = 'layout'
type Layout = 'band' | 'pane'

let step = 0
let hidden = false
let identity: Identity = GRISTLE
let layout: Layout = 'band'
/** True while the pane is open and docked beside the transcript. */
let docked = false
/** Set once an inline pane has been sent away, so one arrival closes it once. */
let inlineClosed = false
/**
 * Whether the person has collapsed the band, as the last draw reported it. The
 * engine owns that state and a mod cannot expand the band, so the only thing to
 * do with it is say so when /buddy runs and nothing shows.
 */
let bandCollapsed = false
let armed = false
/** The one store read, shared by every caller that arrives while it is in flight. */
let loading: Promise<void> | null = null
let cadence: Cadence = clampCadence(undefined, undefined)

/** Which heart state a pet is showing, or null when nobody is being petted. */
let petStep: number | null = null
let petTimer: Timer | null = null

/**
 * Only two cells change between poses, so the timer fires on the change rather
 * than at a frame rate: four redraws a cycle, and the engine repaints the cells.
 */
function armPoses($: EngineInterface) {
  $.clock.after(holdMs(poseAt(step), cadence), () => {
    step += 1
    if (!hidden) $.ui.invalidate('ui.render')
    armPoses($)
  })
}

function endPet() {
  petTimer?.cancel()
  petTimer = null
  petStep = null
}

/**
 * The heart states are held for different lengths, so the timer chains on each
 * one's hold rather than running at a rate, as the poses do. The last hop sets
 * `petStep` to null and still redraws, which is what clears the row.
 */
function advancePet($: EngineInterface) {
  if (petStep === null) return
  petTimer = $.clock.after(heartHoldMs(petStep), () => {
    petTimer = null
    petStep = petStep === null || petStep + 1 >= HEART_STEPS ? null : petStep + 1
    $.ui.invalidate('ui.render')
    advancePet($)
  })
}

function startPet($: EngineInterface) {
  petTimer?.cancel()
  petStep = 0
  $.ui.invalidate('ui.render')
  advancePet($)
}

/**
 * A hot reload drops the pending timer with the old environment and resets
 * every module variable. 2.1.287 raises `session.start` again afterwards, which
 * is what normally restarts the poses and reloads stored state; reaching this
 * from the render hook and the command as well is a safety net that picks both
 * up on the next draw or the next /buddy.
 */
async function ensureRunning($: EngineInterface) {
  loading ??= Promise.all([
    $.store.get('hidden').catch(() => undefined),
    $.store.get(IDENTITY_KEY).catch(() => undefined),
    $.store.get(LAYOUT_KEY).catch(() => undefined),
  ]).then(async ([storedHidden, storedIdentity, storedLayout]) => {
    hidden = storedHidden === true
    identity = identityFrom(storedIdentity)
    layout = storedLayout === 'pane' ? 'pane' : 'band'
    // A reload leaves the pane open and the module blank: ask the engine.
    if (layout === 'pane') {
      const panes = await $.ui.panes().catch(() => [])
      docked = panes.some((pane) => pane.id === PANE && pane.isPlaced)
    }
  })
  await loading
  if (!armed) {
    armed = true
    armPoses($)
  }
}

/**
 * Opens the pane when the buddy lives there and is here. A command opening it
 * is placed from 110 columns; the plugin opening it unasked needs 144, and
 * until then it waits undrawn and the band keeps the buddy.
 */
async function openPane($: EngineInterface) {
  if (layout !== 'pane' || hidden) return
  inlineClosed = false
  const opened = await $.ui
    .open({ id: PANE, title: identity.name, columns: SPECIES_WIDTH + 2 })
    .catch(() => ({ isPlaced: false as const }))
  docked = opened.isPlaced
  $.ui.invalidate('ui.render')
}

async function closePane($: EngineInterface) {
  docked = false
  await $.ui.close({ id: PANE }).catch(() => {})
  $.ui.invalidate('ui.render')
}

type Elements = Awaited<ReturnType<EngineInterface['ui']['resolve']>>

/** The rows of the buddy, hearts first: one drawing for the band and the pane. */
function buddyRows(
  { Text }: Elements,
  hearts: string | null,
  options: Parameters<Register>[1],
) {
  const color =
    identity.color ?? (typeof options?.color === 'string' ? options.color : '#7acf7a')
  const heartColor = typeof options?.heartColor === 'string' ? options.heartColor : '#a7a6fd'
  const showName = options?.showName !== false
  return [
    hearts ? (
      <Text key="sprite:hearts" color={heartColor} wrap="truncate-end">
        {hearts}
      </Text>
    ) : null,
    // Every row, the hearts' included, is SPECIES_WIDTH wide, so the sprite
    // keeps its column whether or not the heart row is drawn.
    ...spriteLines(bonesOf(identity), FRAME_OF_POSE[poseAt(step)]).map((line, i) => (
      <Text key={`sprite:${i}`} color={color} wrap="truncate-end">
        {line}
      </Text>
    )),
    showName ? (
      <Text key="sprite:name" dimColor italic wrap="truncate-end">
        {nameLine(identity.name)}
      </Text>
    ) : null,
  ]
}

/** What /buddy says when the engine's collapsed band is the reason nothing shows. */
function collapsedText(name: string): string {
  return `${name} is here, but the band is collapsed. Press ctrl+x ctrl+a, or click the line above the prompt, to show it.`
}

export const register: Register = (on, options) => {
  cadence = clampCadence(options?.restMs, options?.flickMs)

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: 'buddy',
        description: 'Show, hide, pet, or reroll the buddy above the prompt',
        argumentHint: 'on | off | pet | pane | band | roll | roll back',
        immediate: true,
      })
      .catch(() => {})
    // Off the session.start path: the store read would hold the first prompt.
    $.clock.after(0, () => {
      ensureRunning($).then(() => openPane($)).catch(() => {})
    })
    return r
  })

  on('command.run', { command: 'buddy' }, async ($, e) => {
    await ensureRunning($)
    const name = identity.name
    const verb = e.args.trim().toLowerCase().split(/\s+/).join(' ')
    if (verb === 'pet') {
      // Nothing to pet, and no timer to leave running, while the buddy is away.
      if (hidden) return { text: `${name} is not here. /buddy on brings ${name} back.` }
      startPet($)
      // The line the original printed, verbatim.
      return { text: `petted ${name}` }
    }
    if (verb === 'off') {
      hidden = true
      endPet()
      await $.store.set('hidden', true)
      await closePane($)
      $.ui.invalidate('ui.render')
      return { text: `${name} wanders off. /buddy on brings ${name} back.` }
    }
    if (verb === 'on' || verb === '') {
      const wasHidden = hidden
      hidden = false
      await $.store.set('hidden', false)
      await openPane($)
      $.ui.invalidate('ui.render')
      if (layout === 'band' && bandCollapsed) return { text: collapsedText(name) }
      return { text: wasHidden ? `${name} pads back in.` : `${name} is already here.` }
    }
    if (verb === 'pane') {
      layout = 'pane'
      hidden = false
      await $.store.set(LAYOUT_KEY, 'pane')
      await $.store.set('hidden', false)
      await openPane($)
      return {
        text: docked
          ? `${name} moves to the side.`
          : `${name} stays in the band: the terminal is too narrow for a side pane (110 columns).`,
      }
    }
    if (verb === 'band') {
      layout = 'band'
      await $.store.set(LAYOUT_KEY, 'band')
      await closePane($)
      if (bandCollapsed && !hidden) return { text: collapsedText(name) }
      return { text: `${name} is back above the prompt.` }
    }
    const rename = /^name(?:\s+(.*))?$/is.exec(e.args.trim())
    if (rename) {
      const next = cleanName(rename[1])
      if (next === undefined) {
        return { text: `A name is 1 to ${NAME_MAX} characters (got "${(rename[1] ?? '').trim()}"). ${name} keeps the name.` }
      }
      identity = identityFrom({ ...identity, name: next })
      await $.store.set(IDENTITY_KEY, identity)
      $.ui.invalidate('ui.render')
      return { text: `${name} is now called ${next}.` }
    }
    if (verb === 'roll') {
      const before = identity
      const rolled = roll(Math.random)
      // Only the looks are rolled: the name and any color the person set stay.
      identity = identityFrom({ ...before, ...rolled })
      await $.store.set(PREVIOUS_KEY, before)
      await $.store.set(IDENTITY_KEY, identity)
      $.ui.invalidate('ui.render')
      return { text: `${name} is now ${describe(rolled)}. /buddy roll back undoes it.` }
    }
    if (verb === 'roll back') {
      const previous = await $.store.get(PREVIOUS_KEY).catch(() => undefined)
      if (previous === undefined) return { text: 'Nothing to roll back to.' }
      identity = identityFrom(previous)
      await $.store.set(IDENTITY_KEY, identity)
      // One undo, not a history: a second roll back finds nothing.
      await $.store.delete(PREVIOUS_KEY)
      $.ui.invalidate('ui.render')
      return { text: `${identity.name} is back as before.` }
    }
    return { text: `/buddy takes on, off, pet, pane, band, name <name>, roll or roll back (got "${e.args.trim()}").` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The band is terminal-only, and a survey holding it outranks a cat.
    await ensureRunning($)
    bandCollapsed = e.props.isCollapsed
    if (hidden || docked || e.surface !== 'terminal' || e.props.hasSurvey) return next(e)
    // Six rows of sprite plus whatever else draws; below that, yield the band.
    if (e.props.maxRows < 6 || e.props.bodyColumns < SPECIES_WIDTH) {
      return next(e)
    }

    const elements = await $.ui.resolve(e)
    const { Box } = elements
    // A seventh row has to fit before the hearts can have one of their own.
    const hearts = petStep === null || e.props.maxRows < 7 ? null : heartRow(petStep)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="flex-end">
          {/* The inner column is what gets pushed right, so the rows keep
              their relative offsets instead of each shearing to the edge. */}
          <Box flexDirection="column">
            {buddyRows(elements, hearts, options)}
          </Box>
        </Box>
        {await next(e)}
      </Box>
    )
  })

  // The side pane: drawn only while the buddy lives there. An inline pane (the
  // terminal is too narrow to dock) is a frame above the prompt, which is the
  // band's cost with a border, so it is closed and the band keeps the buddy.
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    await ensureRunning($)
    if (e.props.placement === 'inline') {
      docked = false
      if (!inlineClosed) {
        inlineClosed = true
        $.clock.after(0, () => { closePane($).catch(() => {}) })
      }
      return next(e)
    }
    docked = true
    const elements = await $.ui.resolve(e)
    const { Box } = elements
    const hearts = petStep === null ? null : heartRow(petStep)
    return (
      <Box flexDirection="row" justifyContent="center">
        <Box flexDirection="column">{buddyRows(elements, hearts, options)}</Box>
      </Box>
    )
  })

  // The person's own close mark is the same as /buddy off, or the stored
  // hidden flag and the pane would disagree after a restart.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === 'person') {
      hidden = true
      docked = false
      endPet()
      await $.store.set('hidden', true)
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })
}
