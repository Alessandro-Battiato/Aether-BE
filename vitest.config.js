import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Unit tests never touch the database; integration tests need a real DB.
    // Run them in separate pools so env setup does not bleed across.
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['src/lib/prisma.js'],
    },
    // Integration tests load .env.test (or fall back to .env)
    setupFiles: ['./tests/setup.js'],
  },
});
