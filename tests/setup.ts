import { config } from 'dotenv';

config({ path: '.env.test', override: false });
config({ path: '.env', override: false });

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://test:test@localhost:5432/test';

process.env.JWT_SECRET ??= 'unit-test-secret-32-chars-minimum!!';
process.env.OPENROUTER_API_KEY ??= 'test-key';
