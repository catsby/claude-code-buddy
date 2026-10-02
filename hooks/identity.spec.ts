import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GRISTLE, bonesOf, cleanName, identityFrom } from './identity.ts'

test('nothing stored is Gristle', () => {
  assert.deepEqual(identityFrom(undefined), GRISTLE)
  assert.deepEqual(identityFrom(null), GRISTLE)
  assert.deepEqual(identityFrom('cat'), GRISTLE)
  assert.deepEqual(identityFrom({}), GRISTLE)
})

test('Gristle is the cat the recording shows', () => {
  assert.deepEqual(bonesOf(GRISTLE), { species: 'cat', hat: 'tophat', eye: '✦' })
  assert.equal(GRISTLE.name, 'Gristle')
  assert.equal(GRISTLE.color, undefined)
})

test('a stored identity is kept whole', () => {
  const duck = { species: 'duck', hat: 'wizard', eye: '◉', name: 'Quill', color: '#ffcc00' }
  assert.deepEqual(identityFrom(duck), duck)
})

test('a field the table cannot draw falls back alone', () => {
  assert.deepEqual(identityFrom({ species: 'dog', hat: 'halo', eye: '@', name: 'Rex' }), {
    species: 'cat',
    hat: 'halo',
    eye: '@',
    name: 'Rex',
  })
  assert.equal(identityFrom({ hat: 'fedora' }).hat, 'tophat')
  assert.equal(identityFrom({ eye: 'o' }).eye, '✦')
  assert.equal(identityFrom({ species: 7 }).species, 'cat')
})

test('a hatless buddy stays hatless', () => {
  assert.equal(identityFrom({ hat: 'none' }).hat, 'none')
})

test('a blank name is no name, and a name is trimmed', () => {
  assert.equal(identityFrom({ name: '   ' }).name, 'Gristle')
  assert.equal(identityFrom({ name: '  Mochi ' }).name, 'Mochi')
})

test('a name too long to draw whole falls back rather than being cut', () => {
  assert.equal(identityFrom({ name: 'Maximiliano!' }).name, 'Maximiliano!')
  assert.equal(identityFrom({ name: 'Wolfeschlegelstein' }).name, 'Gristle')
  assert.equal(identityFrom({ name: 'Wolfeschlegelstein', species: 'duck' }).species, 'duck')
})

test('a stored rarity is ignored: rarity is rolled but not kept', () => {
  assert.equal('rarity' in identityFrom({ rarity: 'epic' }), false)
})

test('a blank color leaves the color to /config', () => {
  assert.equal('color' in identityFrom({ color: '' }), false)
  assert.equal(identityFrom({ color: ' red ' }).color, 'red')
})

test('cleanName trims, and rejects blank or too long rather than cutting', () => {
  assert.equal(cleanName('  Mochi '), 'Mochi')
  assert.equal(cleanName('Maximiliano!'), 'Maximiliano!')
  assert.equal(cleanName('Wolfeschlegelstein'), undefined)
  assert.equal(cleanName('   '), undefined)
  assert.equal(cleanName(undefined), undefined)
})
