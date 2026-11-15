// API service with caching, request deduplication, and cancellation support

const BASE_API_URL = 'http://127.0.0.1:8000/api';
const SESSION_CACHE_PREFIX = 'fireverse_cache_';

// In‑memory module cache for instant access
const memoryCache = new Map();
// Map of currently in‑flight requests to deduplicate concurrent calls
const inFlightRequests = new Map();

/**
 * Fetch NASA FIRMS fires data from FastAPI backend with deduplication and caching.
 * @param {Object} options
 * @param {number} [options.days=5] - Number of days of fire data to fetch (1‑5)
 * @param {number} [options.limit=1500] - Sample limit for individual records
 * @param {AbortSignal} [options.signal] - AbortSignal for request cancellation
 * @param {boolean} [options.forceRefresh=false] - Bypass client cache if true
 * @returns {Promise<Object>} Backend response data
 */
export async function fetchFires({
  days = 5,
  limit = 1500,
  signal = null,
  forceRefresh = false,
  mode = "both",
} = {}) {
  const cacheKey = `fires_days${days}_limit${limit}_mode${mode}`;

  // 1. In‑memory cache
  if (!forceRefresh && memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  // 2. Session storage cache (fallback)
  if (!forceRefresh) {
    try {
      const stored = sessionStorage.getItem(SESSION_CACHE_PREFIX + cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch {
      // ignore parse / quota errors
    }
  }

  // 3. Deduplicate concurrent requests
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const url = `${BASE_API_URL}/fires?days=${encodeURIComponent(days)}&limit=${encodeURIComponent(limit)}&mode=${encodeURIComponent(mode)}`;

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, {
        signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`NASA FIRMS Backend Error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      // store caches
      memoryCache.set(cacheKey, data);
      try {
        sessionStorage.setItem(SESSION_CACHE_PREFIX + cacheKey, JSON.stringify(data));
      } catch {
        // ignore storage errors
      }
      return data;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidate client‑side caches (e.g. on manual refresh).
 */
export function invalidateCache() {
  memoryCache.clear();
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(SESSION_CACHE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // ignore storage errors
  }
}
