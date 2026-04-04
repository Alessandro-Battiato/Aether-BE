/**
 * Integration tests for /api/v1/auth
 *
 * These tests hit a real Express app wired to a real PostgreSQL database.
 * Set TEST_DATABASE_URL in .env.test and run `prisma migrate deploy` first.
 *
 * The AI service is mocked so no OpenRouter credits are consumed.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

// ─── Use the test database ────────────────────────────────────────────────────
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.DATABASE_URL = DATABASE_URL;

import app from '../../src/app.js';

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean in cascade-safe order
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.user.deleteMany();
});

// ─── POST /api/v1/auth/register ─────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
  it('returns 201 and a token for valid input', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user.email).toBe('alice@test.com');
    expect(typeof res.body.data.token).toBe('string');
  });

  it('returns 409 when email is already taken', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice2',
      email: 'alice@test.com',
      password: 'password456',
    });

    expect(res.status).toBe(409);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('returns 400 for a password shorter than 8 chars', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob',
      email: 'bob@test.com',
      password: 'short',
    });
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/auth/login ─────────────────────────────────────────────────────
describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
    });
  });

  it('returns 200 and a token for valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'alice@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe('string');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'alice@test.com',
      password: 'wrong',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@test.com',
      password: 'password123',
    });
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/auth/me ─────────────────────────────────────────────────────────
describe('GET /api/v1/auth/me', () => {
  it('returns the user when authenticated', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.data.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('alice@test.com');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
