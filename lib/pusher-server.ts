import Pusher from "pusher"

// Channel names
export const GAME_CHANNEL = "game-channel"

// Event names
export const EVENTS = {
  QUESTION_UPDATE: "question-update",
  SHOW_RESULTS: "show-results",
  GAME_RESET: "game-reset",
  VOTE_UPDATE: "vote-update",
  CUSTOM_ANSWER_ADDED: "custom-answer-added",
}

// Check if we're in a development/preview environment
const isPreviewEnv = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development"

// Create a mock Pusher implementation for preview environments
class MockPusher {
  async trigger(channel: string, event: string, data: any) {
    console.log(`[MockPusher] Would trigger event "${event}" on channel "${channel}" with data:`, data)
    return Promise.resolve({ success: true })
  }
}

// Use the mock implementation in preview environments, real Pusher otherwise
export const pusherServer = isPreviewEnv
  ? (new MockPusher() as unknown as Pusher)
  : new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    })

// Helper function to safely trigger Pusher events with error handling
export async function safeTrigger(channel: string, event: string, data: any) {
  try {
    console.log(`Triggering event "${event}" on channel "${channel}" with data:`, data)
    await pusherServer.trigger(channel, event, data)
    return { success: true }
  } catch (error) {
    console.error(`Error triggering Pusher event "${event}" on channel "${channel}":`, error)
    return { success: false, error }
  }
}
