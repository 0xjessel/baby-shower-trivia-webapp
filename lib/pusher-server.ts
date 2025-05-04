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

// Create the Pusher server instance
export const pusherServer = new Pusher({
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
