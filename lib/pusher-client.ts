"use client"

import PusherClient from "pusher-js"

// Event names
export const EVENTS = {
  QUESTION_UPDATE: "question-update",
  SHOW_RESULTS: "show-results",
  GAME_RESET: "game-reset",
  VOTE_UPDATE: "vote-update",
  CUSTOM_ANSWER_ADDED: "custom-answer-added",
}

// Channel names
export const GAME_CHANNEL = "game-channel"

// Mock PusherClient for preview environments
class MockPusherClient {
  subscribe(channel: string) {
    console.log(`[MockPusherClient] Subscribing to channel: ${channel}`)
    return {
      bind: (event: string, callback: Function) => {
        console.log(`[MockPusherClient] Binding to event "${event}" on channel "${channel}"`)
      },
      unbind: (event: string) => {
        console.log(`[MockPusherClient] Unbinding from event "${event}" on channel "${channel}"`)
      },
    }
  }

  unsubscribe(channel: string) {
    console.log(`[MockPusherClient] Unsubscribing from channel: ${channel}`)
  }

  disconnect() {
    console.log(`[MockPusherClient] Disconnecting`)
  }
}

// Function to create a Pusher client by fetching configuration from the API
export async function createPusherClient() {
  try {
    // Check if we're in a preview environment
    const isPreviewEnv = window.location.hostname === "localhost" || window.location.hostname.includes("vercel.app")

    if (isPreviewEnv) {
      console.log("[PusherClient] Using mock client in preview environment")
      return new MockPusherClient() as unknown as PusherClient
    }

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
    // Return mock client as fallback
    return new MockPusherClient() as unknown as PusherClient
  }
}
