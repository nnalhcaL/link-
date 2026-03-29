import type {LocationSearchCandidate} from '@/lib/types';

const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const LOCATION_RATE_LIMIT_WINDOW_MS = 1000 * 60;
const LOCATION_RATE_LIMIT_MAX_REQUESTS = 8;

interface LocationSearchCacheEntry {
  candidates: LocationSearchCandidate[];
  expiresAt: number;
}

interface LocationRateLimitEntry {
  count: number;
  resetAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var locationSearchCache: Map<string, LocationSearchCacheEntry> | undefined;
  // eslint-disable-next-line no-var
  var locationSearchRateLimit: Map<string, LocationRateLimitEntry> | undefined;
}

const locationSearchCache = global.locationSearchCache ?? new Map<string, LocationSearchCacheEntry>();
const locationSearchRateLimit = global.locationSearchRateLimit ?? new Map<string, LocationRateLimitEntry>();

if (process.env.NODE_ENV !== 'production') {
  global.locationSearchCache = locationSearchCache;
  global.locationSearchRateLimit = locationSearchRateLimit;
}

function cleanupExpiredEntries() {
  const now = Date.now();

  for (const [key, entry] of locationSearchCache.entries()) {
    if (entry.expiresAt <= now) {
      locationSearchCache.delete(key);
    }
  }

  for (const [key, entry] of locationSearchRateLimit.entries()) {
    if (entry.resetAt <= now) {
      locationSearchRateLimit.delete(key);
    }
  }
}

function cacheKey(query: string) {
  return query.trim().toLowerCase();
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{
        type?: unknown;
        text?: unknown;
      }>;
    }>;
  };

  if (typeof record.output_text === 'string') {
    return record.output_text;
  }

  for (const item of record.output ?? []) {
    for (const content of item.content ?? []) {
      if ((content.type === 'output_text' || content.type === 'text') && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  return '';
}

async function normalizeLocationQuery(query: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return query;
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      store: false,
      input: `Normalize this event location input into a concise geocoding search query. Keep the place or address specific, remove extra commentary, and return only the clean location query.\n\nInput: ${query}`,
      text: {
        format: {
          type: 'json_schema',
          name: 'normalized_location_query',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              normalized_query: {
                type: 'string',
                minLength: 1,
              },
            },
            required: ['normalized_query'],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI normalization failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;
  const outputText = extractResponseText(payload);

  if (!outputText) {
    return query;
  }

  try {
    const parsed = JSON.parse(outputText) as {normalized_query?: unknown};
    return typeof parsed.normalized_query === 'string' && parsed.normalized_query.trim() ? parsed.normalized_query.trim() : query;
  } catch {
    return query;
  }
}

export function getLocationSearchRateLimitKey(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headers.get('x-real-ip')?.trim();

  return forwardedFor || realIp || 'local-search';
}

export function consumeLocationSearchRateLimit(key: string) {
  cleanupExpiredEntries();

  const now = Date.now();
  const current = locationSearchRateLimit.get(key);

  if (!current || current.resetAt <= now) {
    locationSearchRateLimit.set(key, {
      count: 1,
      resetAt: now + LOCATION_RATE_LIMIT_WINDOW_MS,
    });

    return {allowed: true as const};
  }

  if (current.count >= LOCATION_RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  locationSearchRateLimit.set(key, current);

  return {allowed: true as const};
}

export async function searchLocationCandidates(query: string) {
  cleanupExpiredEntries();

  const trimmedQuery = query.trim();
  const key = cacheKey(trimmedQuery);
  const cached = locationSearchCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.candidates;
  }

  let normalizedQuery = trimmedQuery;

  try {
    normalizedQuery = await normalizeLocationQuery(trimmedQuery);
  } catch (error) {
    console.warn('Location normalization failed; falling back to the raw query.', error);
  }

  const searchUrl = new URL('https://nominatim.openstreetmap.org/search');
  searchUrl.searchParams.set('q', normalizedQuery);
  searchUrl.searchParams.set('format', 'jsonv2');
  searchUrl.searchParams.set('addressdetails', '1');
  searchUrl.searchParams.set('limit', '3');

  const response = await fetch(searchUrl.toString(), {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'LinkApp/1.0 (structured location search)',
    },
  });

  if (!response.ok) {
    throw new Error(`Location search failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Array<{
    display_name?: string;
    name?: string;
    lat?: string;
    lon?: string;
  }>;

  const candidates = payload
    .map((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      const address = item.display_name?.trim() ?? '';
      const label = item.name?.trim() || address.split(',')[0]?.trim() || '';

      if (!label || !address || Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return null;
      }

      return {
        label,
        address,
        latitude,
        longitude,
      } satisfies LocationSearchCandidate;
    })
    .filter((candidate): candidate is LocationSearchCandidate => candidate !== null);

  locationSearchCache.set(key, {
    candidates,
    expiresAt: Date.now() + LOCATION_CACHE_TTL_MS,
  });

  return candidates;
}
