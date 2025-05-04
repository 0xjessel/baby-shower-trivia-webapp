// Simple in-memory rate limiter
const rateLimits: Record<string, { count: number; resetTime: number }> = {}

// Default limits
const DEFAULT_MAX_REQUESTS = 10 // Default max requests per window
const DEFAULT_WINDOW_MS = 60000 // Default window size in milliseconds

/**
 * Check if a request is allowed based on rate limiting
 * @param key Unique identifier for the rate limit (e.g., IP address, endpoint, etc.)
 * @param maxRequests Maximum number of requests allowed in the time window
 * @param windowMs Time window in milliseconds
 * @returns Object with allowed status and retry-after time if rate limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS,
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()

  // Initialize or get the rate limit entry for this key
  if (!rateLimits[key] || now > rateLimits[key].resetTime) {
    rateLimits[key] = {
      count: 1,
      resetTime: now + windowMs,
    }
    return { allowed: true }
  }

  // Increment the request count
  rateLimits[key].count++

  // Check if the rate limit has been exceeded
  if (rateLimits[key].count > maxRequests) {
    // Calculate how many seconds until the rate limit resets
    const retryAfter = Math.ceil((rateLimits[key].resetTime - now) / 1000)
    return { allowed: false, retryAfter }
  }

  return { allowed: true }
}

// Clean up expired rate limits periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const key in rateLimits) {
    if (now > rateLimits[key].resetTime) {
      delete rateLimits[key]
    }
  }
}, 60000) // Clean up every minute
