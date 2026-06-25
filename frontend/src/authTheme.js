/** App-wide theme (login, register, and authenticated shell). */
export const THEME_STORAGE_KEY = 'mediflow_theme'
export const AUTH_THEME_STORAGE_KEY = 'mediflow_landing_theme'

export function getStoredTheme() {
  try {
    const primary = localStorage.getItem(THEME_STORAGE_KEY)
    if (primary === 'dark' || primary === 'light') return primary
    const legacy = localStorage.getItem(AUTH_THEME_STORAGE_KEY)
    if (legacy === 'dark' || legacy === 'light') return legacy
  } catch {
    /* ignore */
  }
  return 'light'
}

/** @deprecated use getStoredTheme */
export function getStoredAuthTheme() {
  return getStoredTheme()
}

export function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return
  const mode = theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', mode)
}

/** @deprecated use applyThemeToDocument */
export function applyAuthThemeToDocument(theme) {
  applyThemeToDocument(theme)
}

export function setStoredTheme(theme) {
  const mode = theme === 'light' ? 'light' : 'dark'
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
    localStorage.setItem(AUTH_THEME_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
  applyThemeToDocument(mode)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('mediflow-theme-change'))
  }
  return mode
}

export function toggleStoredTheme() {
  const next = getStoredTheme() === 'light' ? 'dark' : 'light'
  setStoredTheme(next)
  return next
}
