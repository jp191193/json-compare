import assert from 'node:assert/strict'
import { test } from 'node:test'
import { copyChange } from './applyChange.ts'
import { buildLineDiff } from './lineDiff.ts'

const left = {
  name: 'Alice',
  age: 30,
  active: true,
  address: { city: 'Paris', zip: '75001' },
}
const right = {
  name: 'Alice',
  age: 31,
  role: 'admin',
  address: { city: 'Lyon', zip: '75001' },
}

const delta = {
  age: [30, 31],
  active: [true, 0, 0],
  role: ['admin'],
  address: { city: ['Paris', 'Lyon'] },
}

function built() {
  return buildLineDiff(left, right, delta)
}

test('records object keys so a change can be copied either way', () => {
  const { changes } = built()
  const age = changes.find((change) => change.path === '$.age')
  const active = changes.find((change) => change.path === '$.active')
  const role = changes.find((change) => change.path === '$.role')
  const city = changes.find((change) => change.path === '$.address.city')
  assert.equal(age?.leftKey, 'age')
  assert.equal(age?.rightKey, 'age')
  assert.equal(active?.kind, 'removed')
  assert.equal(active?.rightKey, undefined)
  assert.equal(role?.kind, 'added')
  assert.equal(role?.leftKey, undefined)
  assert.deepEqual(city?.leftParent, ['address'])
  assert.deepEqual(city?.rightParent, ['address'])
})

test('copies a modified value, an added key, and a removed key', () => {
  const { changes } = built()
  const age = changes.find((change) => change.path === '$.age')!
  const role = changes.find((change) => change.path === '$.role')!
  const active = changes.find((change) => change.path === '$.active')!

  const aged = copyChange(left, right, age, 'to-left')
  assert.equal((aged.left as { age: number }).age, 31)
  assert.equal((aged.right as { age: number }).age, 31)

  const withRole = copyChange(left, right, role, 'to-left')
  assert.deepEqual(Object.keys(withRole.left as object), ['name', 'age', 'active', 'role', 'address'])
  assert.equal((withRole.left as { role: string }).role, 'admin')

  const withoutRole = copyChange(left, right, role, 'to-right')
  assert.equal('role' in (withoutRole.right as object), false)

  const withActive = copyChange(left, right, active, 'to-right')
  assert.deepEqual(Object.keys(withActive.right as object), ['name', 'age', 'role', 'active', 'address'])
  assert.equal((withActive.right as { active: boolean }).active, true)

  const withoutActive = copyChange(left, right, active, 'to-left')
  assert.equal('active' in (withoutActive.left as object), false)
})

test('copies a nested field without reordering its siblings', () => {
  const { changes } = built()
  const city = changes.find((change) => change.path === '$.address.city')!
  const next = copyChange(left, right, city, 'to-left')
  assert.deepEqual((next.left as { address: { city: string; zip: string } }).address, {
    city: 'Lyon',
    zip: '75001',
  })
})

test('inserts an array element and deletes one', () => {
  const source = [1, 3]
  const edited = [1, 2, 3]
  const { changes } = buildLineDiff(source, edited, { _t: 'a', 1: [2] })
  const added = changes.find((change) => change.kind === 'added')!
  const inserted = copyChange(source, edited, added, 'to-left')
  assert.deepEqual(inserted.left, [1, 2, 3])
  const removed = copyChange(source, edited, added, 'to-right')
  assert.deepEqual(removed.right, [1, 3])
})

test('moves an array element to the other side’s position', () => {
  const source = ['a', 'b', 'c']
  const edited = ['a', 'c', 'b']
  const { changes } = buildLineDiff(source, edited, { _t: 'a', _1: ['b', 2, 3] })
  const moved = changes.find((change) => change.kind === 'moved')!
  assert.equal(moved.leftKey, 1)
  assert.equal(moved.rightKey, 2)
  assert.deepEqual(copyChange(source, edited, moved, 'to-left').left, ['a', 'c', 'b'])
  assert.deepEqual(copyChange(source, edited, moved, 'to-right').right, ['a', 'b', 'c'])
})
