import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (pw: string) => `hashed:${pw}`),
    compare: vi.fn(async (plain: string, hashed: string) => hashed === `hashed:${plain}`),
  },
}));

import { prisma } from '../../../src/lib/prisma.js';
import { register, login, getMe } from '../../../src/services/auth.service.js';
import { AppError } from '../../../src/middleware/errorHandler.js';

beforeEach(() => vi.clearAllMocks());

describe('register', () => {
  it('creates a user and returns a token when the email is new', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      createdAt: new Date(),
    } as never);

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
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as never);

    await expect(
      register({ email: 'taken@example.com', password: 'secret123', name: 'Bob' }),
    ).rejects.toThrow(AppError);

    await expect(
      register({ email: 'taken@example.com', password: 'secret123', name: 'Bob' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('login', () => {
  it('returns user and token for valid credentials', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      password: 'hashed:correct-password',
      name: 'Alice',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await login({ email: 'alice@example.com', password: 'correct-password' });

    expect(result.user.email).toBe('alice@example.com');
    expect(result.user).not.toHaveProperty('password');
    expect(typeof result.token).toBe('string');
  });

  it('throws 401 for wrong password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      password: 'hashed:correct-password',
      name: 'Alice',
    } as never);

    await expect(
      login({ email: 'alice@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when user does not exist', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(
      login({ email: 'nobody@example.com', password: 'any' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('getMe', () => {
  it('returns the user record for a valid id', async () => {
    const user = { id: 'user-1', email: 'alice@example.com', name: 'Alice', createdAt: new Date() };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);

    const result = await getMe('user-1');
    expect(result).toEqual(user);
  });

  it('throws 404 when the user is not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(getMe('missing-id')).rejects.toMatchObject({ statusCode: 404 });
  });
});
