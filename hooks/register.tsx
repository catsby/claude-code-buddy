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
 * The engine draws the band's own collapse mark (`[-]`) hard against the right
 * edge, over whatever the hook put there. Hold the sprite clear of it.
 */
const COLLAPSE_MARK_COLUMNS = 4

let step = 0
let hidden = false
let identity: Identity = GRISTLE
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
  ]).then(([storedHidden, storedIdentity]) => {
    hidden = storedHidden === true
    identity = identityFrom(storedIdentity)
  })
  await loading
  if (!armed) {
    armed = true
    armPoses($)
  }
}

export const register: Register = (on, options) => {
  cadence = clampCadence(options?.restMs, options?.flickMs)

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: 'buddy',
        description: 'Show, hide, pet, or reroll the buddy above the prompt',
        argumentHint: 'on | off | pet | roll | roll back',
        immediate: true,
      })
      .catch(() => {})
    // Off the session.start path: the store read would hold the first prompt.
    $.clock.after(0, () => { ensureRunning($).catch(() => {}) })
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
      $.ui.invalidate('ui.render')
      return { text: `${name} wanders off. /buddy on brings ${name} back.` }
    }
    if (verb === 'on' || verb === '') {
      const wasHidden = hidden
      hidden = false
      await $.store.set('hidden', false)
      $.ui.invalidate('ui.render')
      return { text: wasHidden ? `${name} pads back in.` : `${name} is already here.` }
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
    return { text: `/buddy takes on, off, pet, name <name>, roll or roll back (got "${e.args.trim()}").` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The band is terminal-only, and a survey holding it outranks a cat.
    await ensureRunning($)
    if (hidden || e.surface !== 'terminal' || e.props.hasSurvey) return next(e)
    // Six rows of sprite plus whatever else draws; below that, yield the band.
    if (e.props.maxRows < 6 || e.props.bodyColumns < SPECIES_WIDTH + COLLAPSE_MARK_COLUMNS) {
      return next(e)
    }

    const { Box, Text } = await $.ui.resolve(e)
    const color =
      identity.color ?? (typeof options?.color === 'string' ? options.color : '#7acf7a')
    const heartColor = typeof options?.heartColor === 'string' ? options.heartColor : '#a7a6fd'
    const showName = options?.showName !== false
    // A seventh row has to fit before the hearts can have one of their own.
    const hearts = petStep === null || e.props.maxRows < 7 ? null : heartRow(petStep)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="flex-end">
          {/* The inner column is what gets pushed right, so the rows keep
              their relative offsets instead of each shearing to the edge. */}
          <Box flexDirection="column" marginRight={COLLAPSE_MARK_COLUMNS}>
            {hearts ? (
              <Text key="sprite:hearts" color={heartColor} wrap="truncate-end">
                {hearts}
              </Text>
            ) : null}
            {/* Every row, the hearts' included, is SPECIES_WIDTH wide, so the
                sprite keeps its column whether or not the heart row is drawn. */}
            {spriteLines(bonesOf(identity), FRAME_OF_POSE[poseAt(step)]).map((line, i) => (
              <Text key={`sprite:${i}`} color={color} wrap="truncate-end">
                {line}
              </Text>
            ))}
            {showName ? (
              <Text key="sprite:name" dimColor italic wrap="truncate-end">
                {nameLine(identity.name)}
              </Text>
            ) : null}
          </Box>
        </Box>
        {await next(e)}
      </Box>
    )
  })
}
