import type { CustomAnswer } from "@/types/game"

/**
 * Check if a custom answer is a duplicate
 */
export function isDuplicateCustomAnswer(newAnswer: string | CustomAnswer, existingAnswers: CustomAnswer[]): boolean {
  const text = typeof newAnswer === "string" ? newAnswer.trim().toLowerCase() : newAnswer.text.trim().toLowerCase()

  return existingAnswers.some(
    (ca) => (typeof newAnswer !== "string" && ca.id === newAnswer.id) || ca.text.trim().toLowerCase() === text,
  )
}

/**
 * Format API fetch options with cache control headers
 */
export function getApiOptions(): RequestInit {
  return {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  }
}

/**
 * Generate a unique ID for vote updates
 */
export function generateUpdateId(questionId: string, timestamp?: number): string {
  return `${questionId}-${timestamp || Date.now()}`
}
