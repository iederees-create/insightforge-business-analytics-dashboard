/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/insightforge-business-analytics-dashboard/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Exclude the Python pipeline/analyst-toolkit venvs: apache-airflow's
    // wheel ships its own bundled JS frontend source (including .test.tsx
    // files) under site-packages, which Vitest would otherwise try to
    // collect and fail to resolve since it isn't part of this project.
    exclude: ['**/node_modules/**', '**/pipeline/**', '**/analyst-toolkit/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
