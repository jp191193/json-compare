import { useCallback, useEffect, useMemo, useState } from 'react'
import { findUnchangedFolds, foldKey, type UnchangedFold } from './collapseUnchanged'
import type { DiffLine } from './lineDiff'

export function useUnchangedCollapse(leftLines?: DiffLine[], rightLines?: DiffLine[]) {
  const [enabled, setEnabled] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setExpanded((prev) => (prev.size === 0 ? prev : new Set()))
  }, [leftLines, rightLines])

  const allFolds = useMemo(() => {
    if (!leftLines || !rightLines) return []
    return findUnchangedFolds(leftLines, rightLines)
  }, [leftLines, rightLines])

  const visibleFolds = useMemo(() => {
    if (!enabled) return []
    return allFolds.filter((fold) => !expanded.has(foldKey(fold)))
  }, [allFolds, enabled, expanded])

  const expandFold = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  return {
    enabled,
    setEnabled,
    allFolds,
    visibleFolds,
    expandFold,
    canCollapse: allFolds.length > 0,
  }
}

export type { UnchangedFold }
