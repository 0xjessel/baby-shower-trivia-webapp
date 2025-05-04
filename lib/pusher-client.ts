"use client"

import PusherClient from "pusher-js"

// Event names
export const EVENTS = {
  QUESTION_UPDATE: "question-update",
  SHOW_RESULTS: "show-results",
  GAME_RESET: "game-reset",
  VOTE_UPDATE: "vote-update",
  CUSTOM_ANSWER_ADDED: "custom-answer-added",
  GAME_CHANGE: "game-change",
}

// Channel names
export const GAME_CHANNEL = "game-channel"

// Function to create a Pusher client by fetching configuration from the API
export async function createPusherClient() {
  // Fetch Pusher configuration from the API
  const response = await fetch("/api/pusher-config")

  if (!response.ok) {
    throw new Error(`Failed to fetch Pusher config: ${response.status}`)
  }

  const { key, cluster } = await response.json()

  if (!key || !cluster) {
    throw new Error("Invalid Pusher configuration received")
  }

  // Enable Pusher logging for debugging
  PusherClient.logToConsole = process.env.NODE_ENV === "development"

  // Create and return the Pusher client
  const client = new PusherClient(key, {
    cluster,
    channelAuthorization: {
      endpoint: "/api/pusher-auth", // Replace with your auth endpoint
    },
  })

  return client
}

// Export the Pusher client instance
export const pusherClient = await createPusherClient()
