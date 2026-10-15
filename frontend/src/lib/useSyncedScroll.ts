import { useEffect, useRef, type RefObject } from 'react'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import type { EditorView } from '@codemirror/view'

// Line-index based (not scrollTop-ratio based) so the same logical row stays
// aligned on both sides even when total line counts differ slightly —
// possible because lineDiff.ts guarantees both sides have equal line counts
// once a diff has been computed, so "line N" means the same thing on both.
const SETTLE_MS = 120

function syncFollowerScroll(sourceView: EditorView, targetView: EditorView) {
  const sourceScroll = sourceView.scrollDOM
  const targetScroll = targetView.scrollDOM
  const sourceTop = sourceScroll.scrollTop
  const sourceBlock = sourceView.lineBlockAtHeight(sourceTop)
  const offsetInBlock = sourceTop - sourceBlock.top
  const lineNumber = sourceView.state.doc.lineAt(sourceBlock.from).number
  const clampedLine = Math.min(lineNumber, targetView.state.doc.lines)
  const targetLine = targetView.state.doc.line(clampedLine)
  const targetBlock = targetView.lineBlockAt(targetLine.from)
  const maxScroll = Math.max(0, targetScroll.scrollHeight - targetScroll.clientHeight)
  const nextTop = Math.max(0, Math.min(targetBlock.top + offsetInBlock, maxScroll))
  if (Math.abs(targetScroll.scrollTop - nextTop) < 0.5) return
  targetScroll.scrollTop = nextTop
}

export function useSyncedScroll(
  leftRef: RefObject<ReactCodeMirrorRef | null>,
  rightRef: RefObject<ReactCodeMirrorRef | null>,
  enabled: boolean,
) {
  const driver = useRef<'left' | 'right' | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return
    const leftView = leftRef.current?.view
    const rightView = rightRef.current?.view
    if (!leftView || !rightView) return

    function releaseDriverSoon() {
      if (settleTimer.current) clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(() => {
        driver.current = null
        settleTimer.current = null
      }, SETTLE_MS)
    }

    function makeHandler(side: 'left' | 'right', sourceView: EditorView, targetView: EditorView) {
      return () => {
        if (driver.current && driver.current !== side) return
        driver.current = side
        syncFollowerScroll(sourceView, targetView)
        releaseDriverSoon()
      }
    }

    const onLeftScroll = makeHandler('left', leftView, rightView)
    const onRightScroll = makeHandler('right', rightView, leftView)
    leftView.scrollDOM.addEventListener('scroll', onLeftScroll, { passive: true })
    rightView.scrollDOM.addEventListener('scroll', onRightScroll, { passive: true })

    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current)
      driver.current = null
      leftView.scrollDOM.removeEventListener('scroll', onLeftScroll)
      rightView.scrollDOM.removeEventListener('scroll', onRightScroll)
    }
  }, [enabled, leftRef, rightRef])
}
