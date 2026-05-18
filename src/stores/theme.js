/**
 * stores/theme.js — Light/dark theme preference
 *
 * Defaults to 'light'. Persists to localStorage.
 * Applies a data-theme attribute to <html> so CSS variables cascade everywhere.
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const stored = localStorage.getItem('pacer-theme')
  const theme  = ref(stored || 'light')

  function apply(t) {
    document.documentElement.setAttribute('data-theme', t)
  }

  // Apply immediately when the store is first accessed
  apply(theme.value)

  watch(theme, (t) => {
    localStorage.setItem('pacer-theme', t)
    apply(t)
  })

  function toggle() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  return { theme, toggle }
})
