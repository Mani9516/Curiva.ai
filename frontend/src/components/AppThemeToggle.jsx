import { useState, useEffect } from 'react'
import { getStoredTheme, setStoredTheme } from '../authTheme'

/** Compact theme switch for authenticated shell header. */
export default function AppThemeToggle() {
  const [light, setLight] = useState(() => getStoredTheme() === 'light')

  useEffect(() => {
    const sync = () => setLight(getStoredTheme() === 'light')
    window.addEventListener('mediflow-theme-change', sync)
    return () => window.removeEventListener('mediflow-theme-change', sync)
  }, [])

  useEffect(() => {
    setStoredTheme(light ? 'light' : 'dark')
  }, [light])

  return (
    <button
      type="button"
      className="header-theme-toggle"
      onClick={() => setLight((v) => !v)}
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
      title={light ? 'Dark mode' : 'Light mode'}
    >
      {light ? '🌙' : '☀️'}
    </button>
  )
}
