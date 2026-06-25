import { useState, useEffect } from 'react'
import { getStoredTheme, setStoredTheme } from '../authTheme'

export default function AuthThemeToggle() {
  const [theme, setTheme] = useState(() => getStoredTheme())

  useEffect(() => {
    setStoredTheme(theme)
  }, [theme])

  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className="login-theme-toggle"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  )
}
