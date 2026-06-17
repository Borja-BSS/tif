'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const resolved: Theme = mq.matches ? 'dark' : 'light'
    setTheme(resolved)
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(resolved)

    const handleSystemChange = (e: MediaQueryListEvent) => {
      const next: Theme = e.matches ? 'dark' : 'light'
      setTheme(next)
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(next)
    }
    mq.addEventListener('change', handleSystemChange)
    return () => mq.removeEventListener('change', handleSystemChange)
  }, [])

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('tif-theme', next)
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
