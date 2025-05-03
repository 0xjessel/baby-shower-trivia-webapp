"use client"

import PusherClient from "pusher-js"

// Event names
export const EVENTS = {
  QUESTION_UPDATE: "question-update",
  SHOW_RESULTS: "show-results",
  GAME_RESET: "game-reset",
}

// Channel names
export const GAME_CHANNEL = "game-channel"

// Function to create a Pusher client by fetching configuration from the API
export async function createPusherClient() {
  try {
    // Fetch Pusher configuration from the API
    const response = await fetch("/api/pusher-config")

    if (!response.ok) {
      throw new Error(`Failed to fetch Pusher config: ${response.status}`)
    }

    const { key, cluster } = await response.json()

    if (!key || !cluster) {
      throw new Error("Invalid Pusher configuration received")
    }

    // Create and return the Pusher client
    return new PusherClient(key, { cluster })
  } catch (error) {
    console.error("Failed to initialize Pusher client:", error)
    throw error
  }
}
