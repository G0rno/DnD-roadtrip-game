// Minimal Claude API client for the browser. The API key is entered in Settings and stays in this device's storage.

export const MODELS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5' } as const;
export type Tier = keyof typeof MODELS;

/** USD per million tokens (platform.claude.com pricing, checked 2026-10-20). */
const PRICES: Record<Tier, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  haiku: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  sonnet: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
};

const KEY_STORAGE = 'rrpg.apikey';

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export class AiError extends Error {
  constructor(
    message: string,
    public kind: 'nokey' | 'offline' | 'auth' | 'timeout' | 'http' | 'parse',
  ) {
    super(message);
  }
}

export interface CallOptions {
  tier: Tier;
  /** Static system blocks; all are marked for prompt caching. */
  system: string[];
  user: string;
  schema: object;
  maxTokens: number;
  timeoutMs: number;
}

export interface CallResult<T> {
  data: T;
  usd: number;
  tier: Tier;
}

export async function callJson<T>(o: CallOptions): Promise<CallResult<T>> {
  const key = getApiKey();
  if (!key) throw new AiError('No API key', 'nokey');
  if (!online()) throw new AiError('Offline', 'offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs);
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODELS[o.tier],
        max_tokens: o.maxTokens,
        system: o.system.map((text, i) => ({ type: 'text', text, ...(i === o.system.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}) })),
        messages: [{ role: 'user', content: o.user }],
        output_config: { format: { type: 'json_schema', schema: o.schema } },
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === 'AbortError') throw new AiError('The Game Master took too long', 'timeout');
    throw new AiError('No connection', 'offline');
  }
  clearTimeout(timer);
  if (res.status === 401 || res.status === 403) throw new AiError('The API key was refused', 'auth');
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new AiError(msg, 'http');
  }
  const body = await res.json();
  const u = body.usage ?? {};
  const p = PRICES[o.tier];
  const usd =
    ((u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite + (u.cache_read_input_tokens ?? 0) * p.cacheRead) / 1e6;
  const text = (body.content ?? []).find((c: { type: string }) => c.type === 'text')?.text ?? '';
  try {
    return { data: JSON.parse(text) as T, usd, tier: o.tier };
  } catch {
    throw new AiError('The Game Master answered in an unexpected format', 'parse');
  }
}

/** Quick check used by the Settings screen. */
export async function testKey(): Promise<string> {
  const r = await callJson<{ ok: string }>({
    tier: 'haiku',
    system: ['Reply with JSON only.'],
    user: 'Say ok.',
    schema: { type: 'object', properties: { ok: { type: 'string' } }, required: ['ok'], additionalProperties: false },
    maxTokens: 20,
    timeoutMs: 15000,
  });
  return `Connected. Test call cost $${r.usd.toFixed(5)}.`;
}
