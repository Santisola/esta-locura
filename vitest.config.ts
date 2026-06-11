import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // server-only lanza un error en contextos de cliente; en tests (Node.js) lo
      // reemplazamos con un módulo vacío.
      'server-only': path.resolve(__dirname, './src/__tests__/helpers/server-only-mock.ts'),
    },
  },
})
