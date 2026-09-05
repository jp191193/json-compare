import { Link, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTheme } from './lib/useTheme'
import { getHealth } from './lib/api'
import { ComparePage } from './pages/ComparePage'
import { SharePage } from './pages/SharePage'

function ApiStatusDot() {
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    getHealth()
      .then(() => !cancelled && setOk(true))
      .catch(() => !cancelled && setOk(false))
    return () => {
      cancelled = true
    }
  }, [])

  const color = ok === null ? 'bg-gray-400' : ok ? 'bg-green-500' : 'bg-violet-400'
  const label =
    ok === null
      ? 'Checking API…'
      : ok
        ? 'API online'
        : 'In-browser · JSON stays on this device'

  return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]" title={label}>
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function App() {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="text-[var(--accent)]">{'{ }'}</span>
            JSON Compare
          </Link>
          <div className="flex items-center gap-4">
            <ApiStatusDot />
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--surface-2)]"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<ComparePage theme={theme} />} />
          <Route path="/share/:id" element={<SharePage theme={theme} />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
