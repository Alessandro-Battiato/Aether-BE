import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma before importing the service ────────────────────────────────
vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// ─── Mock bcrypt to keep tests fast (no real hashing) ────────────────────────
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (pw) => `hashed:${pw}`),
    compare: vi.fn(async (plain, hashed) => hashed === `hashed:${plain}`),
  },
}));

import { prisma } from '../../../src/lib/prisma.js';
import { register, login, getMe } from '../../../src/services/auth.service.js';
import { AppError } from '../../../src/middleware/errorHandler.js';

beforeEach(() => vi.clearAllMocks());

// ─── register ────────────────────────────────────────────────────────────────
describe('register', () => {
  it('creates a user and returns a token when the email is new', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      createdAt: new Date(),
    });

    const result = await register({
      email: 'alice@example.com',
      password: 'secret123',
      name: 'Alice',
    });

    expect(prisma.user.create).toHaveBeenCalledOnce();
    expect(result.user.email).toBe('alice@example.com');
    expect(typeof result.token).toBe('string');
  });

  it('throws 409 when email is already taken', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      register({ email: 'taken@example.com', password: 'secret123', name: 'Bob' }),
    ).rejects.toThrow(AppError);

    await expect(
      register({ email: 'taken@example.com', password: 'secret123', name: 'Bob' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ─── login ───────────────────────────────────────────────────────────────────
describe('login', () => {
  it('returns user and token for valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      password: 'hashed:correct-password',
      name: 'Alice',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await login({ email: 'alice@example.com', password: 'correct-password' });

    expect(result.user.email).toBe('alice@example.com');
    expect(result.user).not.toHaveProperty('password');
    expect(typeof result.token).toBe('string');
  });

  it('throws 401 for wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      password: 'hashed:correct-password',
      name: 'Alice',
    });

    await expect(
      login({ email: 'alice@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      login({ email: 'nobody@example.com', password: 'any' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ─── getMe ───────────────────────────────────────────────────────────────────
describe('getMe', () => {
  it('returns the user record for a valid id', async () => {
    const user = { id: 'user-1', email: 'alice@example.com', name: 'Alice', createdAt: new Date() };
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await getMe('user-1');
    expect(result).toEqual(user);
  });

  it('throws 404 when the user is not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(getMe('missing-id')).rejects.toMatchObject({ statusCode: 404 });
  });
});
