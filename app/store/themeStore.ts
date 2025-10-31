import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  isDarkMode: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

// Function to get system preference
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

// Function to determine if dark mode should be active
const getIsDarkMode = (theme: Theme): boolean => {
  if (theme === 'system') {
    return getSystemTheme() === 'dark'
  }
  return theme === 'dark'
}

// Function to apply theme to document
const applyTheme = (isDark: boolean) => {
  if (typeof window !== 'undefined') {
    const root = window.document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      isDarkMode: false,

      setTheme: (theme: Theme) => {
        const isDarkMode = getIsDarkMode(theme)
        applyTheme(isDarkMode)
        set({ theme, isDarkMode })
      },

      toggleTheme: () => {
        const currentTheme = get().theme
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
        get().setTheme(newTheme)
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Apply theme immediately after rehydration
        if (state) {
          const isDarkMode = getIsDarkMode(state.theme)
          applyTheme(isDarkMode)
          // Update state with current system preference if using system theme
          if (state.theme === 'system') {
            state.isDarkMode = isDarkMode
          }
        }
      },
    }
  )
)

// Listen for system theme changes when using system theme
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  
  mediaQuery.addEventListener('change', (e) => {
    const store = useThemeStore.getState()
    if (store.theme === 'system') {
      const isDarkMode = e.matches
      applyTheme(isDarkMode)
      useThemeStore.setState({ isDarkMode })
    }
  })
}