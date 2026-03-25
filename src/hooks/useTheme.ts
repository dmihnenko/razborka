import { useState, useEffect, useCallback } from 'react'

export type AppTheme = 'light' | 'dark'

const STORAGE_KEY = 'app-theme'

function applyTheme(theme: AppTheme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as AppTheme) || 'light'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next)
  }, [])

  return { theme, setTheme }
}
