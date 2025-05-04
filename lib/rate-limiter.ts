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

export function checkRateLimit(identifier: string, limit = 60): boolean {
  const now = Date.now()

  if (!requestCounts[identifier]) {
    requestCounts[identifier] = { count: 1, timestamp: now }
    return true
  }

  // Reset count if it's been more than a minute
  if (now - requestCounts[identifier].timestamp > 60 * 1000) {
    requestCounts[identifier] = { count: 1, timestamp: now }
    return true
  }

  // Increment count
  requestCounts[identifier].count++

  // Check if over limit
  return requestCounts[identifier].count <= limit
}
