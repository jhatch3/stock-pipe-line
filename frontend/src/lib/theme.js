// Light/dark theme. Untitled UI's dark palette applies under the `dark-mode` class on <html>.
const KEY = 'theme'

export function getInitialTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark-mode', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function saveTheme(theme) {
  try { localStorage.setItem(KEY, theme) } catch { /* storage unavailable */ }
}
