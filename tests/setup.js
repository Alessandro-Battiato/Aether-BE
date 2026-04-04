/**
 * Global Vitest setup file.
 *
 * For unit tests  — just ensures dotenv is loaded so env.js doesn't crash.
 * For integration tests — you should point TEST_DATABASE_URL at a real
 *   test database and run `prisma migrate deploy` before the suite.
 *
 * We do NOT tear-down the DB here so that failed tests can be inspected.
 * Each integration test file is responsible for cleaning its own data.
 */
import { config } from 'dotenv';

// Load .env.test first, then fall back to .env
config({ path: '.env.test', override: false });
config({ path: '.env', override: false });

// Prisma 7 reads the database URL from the adapter at module-load time.
// Point DATABASE_URL at the test database before any module imports so the
// adapter in src/lib/prisma.js picks up the right connection string.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://test:test@localhost:5432/test';

// Stub out env vars that are required by src/config/env.js but not needed in
// unit tests — prevents process.exit(1) during import.
process.env.JWT_SECRET ??= 'unit-test-secret-32-chars-minimum!!';
process.env.OPENROUTER_API_KEY ??= 'test-key';
