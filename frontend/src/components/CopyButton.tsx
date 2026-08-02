import { useState } from 'react'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

const BASE_CLASS = 'rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)]'

export function CopyButton({ text, label = 'Copy', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button onClick={handleCopy} className={className ?? BASE_CLASS}>
      {copied ? 'Copied!' : label}
    </button>
  )
}
