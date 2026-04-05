import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    typecheck: { tsconfig: './tsconfig.test.json' },
    environment: 'node',
    globals: true,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/lib/prisma.ts', 'src/types/**'],
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
