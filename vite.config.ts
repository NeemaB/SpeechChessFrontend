/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',              // Simulate browser
    globals: true,                     // Enable global test APIs (describe, test, expect)
    setupFiles: 'test/setup.ts',       // Setup file
    css: true,                         // Allow importing CSS in tests
  },
})
