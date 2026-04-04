/**
 * Integration tests for /api/v1/auth
 *
 * These tests hit a real Express app wired to a real PostgreSQL database.
 * Set TEST_DATABASE_URL in .env.test and run `prisma migrate deploy` first.
 */
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import app from '../../src/app.js';

// DATABASE_URL is set to the test DB by tests/setup.ts before this file loads.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.user.deleteMany();
});

// ─── POST /api/v1/auth/register ──────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
  it('returns 201 and a token for valid input', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
      passwordConfirm: 'password123',
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
      passwordConfirm: 'password123',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice2',
      email: 'alice@test.com',
      password: 'password456',
      passwordConfirm: 'password456',
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
      passwordConfirm: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when passwordConfirm does not match password', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob',
      email: 'bob@test.com',
      password: 'password123',
      passwordConfirm: 'different456',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'passwordConfirm')).toBe(true);
  });
});

// ─── POST /api/v1/auth/login ─────────────────────────────────────────────────
describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
      passwordConfirm: 'password123',
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

// ─── POST /api/v1/auth/logout ────────────────────────────────────────────────
describe('POST /api/v1/auth/logout', () => {
  it('clears the auth cookie and returns success', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ─── GET /api/v1/auth/me ─────────────────────────────────────────────────────
describe('GET /api/v1/auth/me', () => {
  it('returns the user when authenticated', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.data.token as string}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('alice@test.com');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
