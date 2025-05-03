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

    // In preview mode, we'll write to a special endpoint that clients can poll
    // This simulates the realtime updates in preview mode
    try {
      // We could implement a simple in-memory store here if needed
      // For now, we'll just log that we would have triggered an event
      console.log(`[MockPusher] Preview mode - event "${event}" would be broadcast to all clients`)

      // For vote updates specifically, we'll make sure the data is available via the API
      if (event === EVENTS.VOTE_UPDATE) {
        console.log(`[MockPusher] Vote update in preview mode - clients will get this via polling`)
      }

      return Promise.resolve({ success: true })
    } catch (error) {
      console.error(`[MockPusher] Error in mock trigger:`, error)
      return Promise.resolve({ success: false, error })
    }
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
    console.log(`[PUSHER] Triggering event "${event}" on channel "${channel}" with data:`, data)
    await pusherServer.trigger(channel, event, data)
    return { success: true }
  } catch (error) {
    console.error(`[PUSHER] Error triggering Pusher event "${event}" on channel "${channel}":`, error)
    return { success: false, error }
  }
}
