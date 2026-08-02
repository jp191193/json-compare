import { useEffect, useRef, type RefObject } from 'react'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import type { EditorView } from '@codemirror/view'

// Line-index based (not scrollTop-ratio based) so the same logical row stays
// aligned on both sides even when total line counts differ slightly —
// possible because lineDiff.ts guarantees both sides have equal line counts
// once a diff has been computed, so "line N" means the same thing on both.
export function useSyncedScroll(
  leftRef: RefObject<ReactCodeMirrorRef | null>,
  rightRef: RefObject<ReactCodeMirrorRef | null>,
  enabled: boolean,
) {
  const syncing = useRef(false)

  useEffect(() => {
    if (!enabled) return
    const leftView = leftRef.current?.view
    const rightView = rightRef.current?.view
    if (!leftView || !rightView) return

    function makeHandler(sourceView: EditorView, targetView: EditorView) {
      return () => {
        if (syncing.current) return
        syncing.current = true
        const block = sourceView.lineBlockAtHeight(sourceView.scrollDOM.scrollTop)
        const lineNumber = sourceView.state.doc.lineAt(block.from).number
        const clampedLine = Math.min(lineNumber, targetView.state.doc.lines)
        const targetLine = targetView.state.doc.line(clampedLine)
        const targetBlock = targetView.lineBlockAt(targetLine.from)
        targetView.scrollDOM.scrollTop = targetBlock.top
        requestAnimationFrame(() => {
          syncing.current = false
        })
      }
    }

    const onLeftScroll = makeHandler(leftView, rightView)
    const onRightScroll = makeHandler(rightView, leftView)
    leftView.scrollDOM.addEventListener('scroll', onLeftScroll, { passive: true })
    rightView.scrollDOM.addEventListener('scroll', onRightScroll, { passive: true })

    return () => {
      leftView.scrollDOM.removeEventListener('scroll', onLeftScroll)
      rightView.scrollDOM.removeEventListener('scroll', onRightScroll)
    }
  }, [enabled, leftRef, rightRef])
}
