import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findUnchangedFolds, lineRangeOffsets, type UnchangedFold } from './collapseUnchanged.ts'
import type { DiffLine } from './lineDiff.ts'

function line(status: DiffLine['status'], text = 'x'): DiffLine {
  return { text, status }
}

function unchanged(n: number): DiffLine[] {
  return Array.from({ length: n }, () => line('unchanged'))
}

test('no folds when both sides are identical', () => {
  const lines = unchanged(20)
  assert.deepEqual(findUnchangedFolds(lines, lines), [])
})

test('keeps context around a change and folds the long middle', () => {
  const left: DiffLine[] = [
    ...unchanged(10),
    line('modified', '"a": 1'),
    ...unchanged(10),
  ]
  const right: DiffLine[] = [
    ...unchanged(10),
    line('modified', '"a": 2'),
    ...unchanged(10),
  ]
  const folds = findUnchangedFolds(left, right, 2, 4)
  assert.deepEqual(folds, [
    { start: 0, end: 7 },
    { start: 13, end: 20 },
  ] satisfies UnchangedFold[])
})

test('skips short unchanged runs', () => {
  const left: DiffLine[] = [line('unchanged'), line('modified'), line('unchanged')]
  const right: DiffLine[] = [line('unchanged'), line('modified'), line('unchanged')]
  assert.deepEqual(findUnchangedFolds(left, right, 2, 4), [])
})

test('lineRangeOffsets includes newlines between folded lines', () => {
  const lines = [line('unchanged', 'a'), line('unchanged', 'bb'), line('unchanged', 'c')]
  assert.deepEqual(lineRangeOffsets(lines, 0, 1), { from: 0, to: 5 })
})
