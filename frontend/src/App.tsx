import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTheme } from './lib/useTheme'
import { getHealth } from './lib/api'
import { ComparePage } from './pages/ComparePage'
import { SharePage } from './pages/SharePage'
import { GuidPage } from './pages/GuidPage'

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

  const color = ok === null ? 'bg-gray-400' : ok ? 'bg-green-500' : 'bg-red-500'
  const label = ok === null ? 'Checking API…' : ok ? 'API online' : 'API unreachable'

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
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 whitespace-nowrap font-semibold">
              <span className="text-[var(--accent)]">{'{ }'}</span>
              JSON Compare
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  isActive
                    ? 'font-medium text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }
              >
                Compare
              </NavLink>
              <NavLink
                to="/guid"
                className={({ isActive }) =>
                  isActive
                    ? 'font-medium text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }
              >
                GUID
              </NavLink>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-3">
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
          <Route path="/guid" element={<GuidPage />} />
          <Route path="/share/:id" element={<SharePage theme={theme} />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
