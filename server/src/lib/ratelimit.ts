
const buckets = new Map<string, { count: number; ts: number }>();

/**
 * Simple rate limit guard: allow `limit` actions per `windowMs` for `key`.
 * Returns true if allowed, false otherwise.
 */
export function allow(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.ts > windowMs) {
    buckets.set(key, { count: 1, ts: now });
    return true;
  }
  if (b.count < limit) {
    b.count += 1;
    return true;
  }
  return false;
}
