// Simple in-memory rate limiter
const requestCounts: Record<string, { count: number; timestamp: number }> = {}

// Reset the counts every 5 minutes
setInterval(() => {
  const now = Date.now()
  Object.keys(requestCounts).forEach((key) => {
    if (now - requestCounts[key].timestamp > 5 * 60 * 1000) {
      delete requestCounts[key]
    }
  })
}, 60 * 1000)

export function checkRateLimit(identifier: string, limit = 30): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()

  if (!requestCounts[identifier]) {
    requestCounts[identifier] = { count: 1, timestamp: now }
    return { allowed: true }
  }

  // Reset count if it's been more than a minute
  if (now - requestCounts[identifier].timestamp > 60 * 1000) {
    requestCounts[identifier] = { count: 1, timestamp: now }
    return { allowed: true }
  }

  // Increment count
  requestCounts[identifier].count++

  // Check if over limit
  if (requestCounts[identifier].count <= limit) {
    return { allowed: true }
  }

  // Calculate retry-after time in seconds (exponential backoff)
  const overageRatio = requestCounts[identifier].count / limit
  const retryAfter = Math.min(Math.ceil(overageRatio * 5), 30) // Between 5-30 seconds

  return { allowed: false, retryAfter }
}
