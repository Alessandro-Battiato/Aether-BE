import OpenAI from 'openai';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

type SimpleMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type RawModel = {
  id: string;
  name: string;
  description: string;
  pricing?: { prompt: string; completion: string };
};

type PaginatedModels = {
  models: Pick<RawModel, 'id' | 'name' | 'description' | 'pricing'>[];
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
    'X-Title': 'Aether',
  },
});

// ─── Unified model cache ──────────────────────────────────────────────────────

let _modelsCache: { data: RawModel[]; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetches the full OpenRouter model list once and caches it for CACHE_TTL.
 * Both isValidModel() and getModels() share this cache so only one
 * upstream request is needed per hour regardless of how it's called.
 */
/** Resets the in-memory cache. Intended for use in tests only. */
export function resetModelsCache(): void {
  _modelsCache = null;
}

async function getAllModels(): Promise<RawModel[]> {
  const now = Date.now();
  if (_modelsCache && now - _modelsCache.fetchedAt < CACHE_TTL) {
    return _modelsCache.data;
  }
  const res = await fetch(`${env.OPENROUTER_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
  });
  if (!res.ok) throw new AppError('Failed to fetch models from OpenRouter', 502);
  const { data } = (await res.json()) as { data?: RawModel[] };
  const models = data ?? [];
  _modelsCache = { data: models, fetchedAt: now };
  return models;
}

// Providers whose models are known to fail at inference time.
// Filtered out regardless of the ?free flag so they never reach clients.
const BROKEN_PROVIDERS = [
  'minimax/',
  'google/',
  'qwen/',
  'venice/',
  'meta-llama/',
  'nousresearch/',
];

// Individual model IDs that are broken but belong to otherwise-fine providers.
const BROKEN_MODEL_IDS = new Set([
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
]);

function isBlocked(model: RawModel): boolean {
  return (
    BROKEN_PROVIDERS.some((prefix) => model.id.startsWith(prefix)) ||
    BROKEN_MODEL_IDS.has(model.id)
  );
}

function isFree(model: RawModel): boolean {
  if (model.id.endsWith(':free')) return true;
  const p = model.pricing;
  return !!p && p.prompt === '0' && p.completion === '0';
}

// ─── Chat completions ─────────────────────────────────────────────────────────

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

// ─── Model validation ─────────────────────────────────────────────────────────

/**
 * Returns true if modelId exists on OpenRouter.
 * Fails open (returns true) if OpenRouter is unreachable so a temporary
 * outage doesn't break chat creation.
 */
export const isValidModel = async (modelId: string): Promise<boolean> => {
  try {
    const models = await getAllModels();
    return models.some((m) => m.id === modelId);
  } catch {
    return true; // fail open
  }
};

// ─── Model listing ────────────────────────────────────────────────────────────

export const getModels = async ({
  page = 1,
  limit = 20,
  free = false,
}: {
  page?: number;
  limit?: number;
  free?: boolean;
} = {}): Promise<PaginatedModels> => {
  const all = await getAllModels();
  const filtered = (free ? all.filter(isFree) : all).filter((m) => !isBlocked(m));
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const models = filtered
    .slice((page - 1) * limit, page * limit)
    .map(({ id, name, description, pricing }) => ({ id, name, description, pricing }));
  return { models, total, page, limit, totalPages };
};
