import { vi } from 'vitest'

// Doublure du module virtuel « virtual:pwa-register/react », fourni par vite-plugin-pwa au build seulement.
export const useRegisterSW = vi.fn()
