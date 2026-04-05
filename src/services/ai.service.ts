import OpenAI from 'openai';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

type SimpleMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type PaginatedModels = {
  models: { id: string; name: string; description: string }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const openai = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: env.OPENROUTER_BASE_URL,
  defaultHeaders: {
    'HTTP-Referer': env.CLIENT_URL,
    'X-Title': 'GPT Clone',
  },
});

export const generateResponse = async ({
  messages,
  model,
}: {
  messages: SimpleMessage[];
  model: string;
}): Promise<string> => {
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    });
    return completion.choices[0].message.content ?? '';
  } catch (err) {
    throw new AppError(`AI service error: ${(err as Error).message}`, 502);
  }
};

export const generateResponseStream = ({
  messages,
  model,
}: {
  messages: SimpleMessage[];
  model: string;
}) => {
  try {
    return openai.chat.completions.create({
      model,
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      stream: true,
    });
  } catch (err) {
    throw new AppError(`AI service error: ${(err as Error).message}`, 502);
  }
};

// ─── Model validation (cached) ───────────────────────────────────────────────

let _modelCache: { ids: Set<string>; fetchedAt: number } | null = null;
const MODEL_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Returns true if modelId exists on OpenRouter.
 * Fetches the model list once and caches it for MODEL_CACHE_TTL ms.
 * Fails open (returns true) if OpenRouter is unreachable, so a temporary
 * outage doesn't break chat creation.
 */
export const isValidModel = async (modelId: string): Promise<boolean> => {
  const now = Date.now();
  if (!_modelCache || now - _modelCache.fetchedAt > MODEL_CACHE_TTL) {
    const res = await fetch(`${env.OPENROUTER_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
    });
    if (!res.ok) return true; // fail open
    const { data } = (await res.json()) as { data?: { id: string }[] };
    _modelCache = { ids: new Set((data ?? []).map((m) => m.id)), fetchedAt: now };
  }
  return _modelCache.ids.has(modelId);
};

export const getModels = async ({ page = 1, limit = 20 }: { page?: number; limit?: number } = {}): Promise<PaginatedModels> => {
  const res = await fetch(`${env.OPENROUTER_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
  });
  if (!res.ok) throw new AppError('Failed to fetch models from OpenRouter', 502);
  const { data } = (await res.json()) as { data?: { id: string; name: string; description: string }[] };
  const all = (data ?? []).map(({ id, name, description }) => ({ id, name, description }));
  const total = all.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const models = all.slice((page - 1) * limit, page * limit);
  return { models, total, page, limit, totalPages };
};
