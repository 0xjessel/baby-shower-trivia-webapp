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

// Maximum number of connection attempts
const MAX_CONNECTION_ATTEMPTS = 5
// Delay between reconnection attempts (in ms)
const RECONNECTION_DELAY = 2000

// Mock PusherClient for preview environments
class MockPusherClient {
  eventHandlers: Record<string, Record<string, Function[]>> = {}

  subscribe(channel: string) {
    console.log(`[MockPusherClient] Subscribing to channel: ${channel}`)

    if (!this.eventHandlers[channel]) {
      this.eventHandlers[channel] = {}
    }

    return {
      bind: (event: string, callback: Function) => {
        console.log(`[MockPusherClient] Binding to event "${event}" on channel "${channel}"`)
        if (!this.eventHandlers[channel][event]) {
          this.eventHandlers[channel][event] = []
        }
        this.eventHandlers[channel][event].push(callback)
      },
      unbind: (event: string) => {
        console.log(`[MockPusherClient] Unbinding from event "${event}" on channel "${channel}"`)
        if (this.eventHandlers[channel] && this.eventHandlers[channel][event]) {
          delete this.eventHandlers[channel][event]
        }
      },
    }
  }

  unsubscribe(channel: string) {
    console.log(`[MockPusherClient] Unsubscribing from channel: ${channel}`)
    if (this.eventHandlers[channel]) {
      delete this.eventHandlers[channel]
    }
  }

  disconnect() {
    console.log(`[MockPusherClient] Disconnecting`)
    this.eventHandlers = {}
  }

  // Method to simulate receiving an event (for testing)
  simulateEvent(channel: string, event: string, data: any) {
    console.log(`[MockPusherClient] Simulating event "${event}" on channel "${channel}" with data:`, data)
    if (this.eventHandlers[channel] && this.eventHandlers[channel][event]) {
      this.eventHandlers[channel][event].forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`[MockPusherClient] Error in event handler:`, error)
        }
      })
    }
  }
}

// Function to check if we're in a preview environment
function isPreviewEnvironment() {
  if (typeof window === "undefined") return false

  const hostname = window.location.hostname

  // Only consider localhost as preview
  // Your production domain is babyjayceleaguechallenge.vercel.app
  return (
    hostname === "localhost" || (hostname.includes("vercel.app") && !hostname.startsWith("babyjayceleaguechallenge"))
  )
}

// Function to create a Pusher client by fetching configuration from the API
export async function createPusherClient() {
  let connectionAttempts = 0

  const attemptConnection = async (): Promise<PusherClient> => {
    try {
      connectionAttempts++
      console.log(`[PusherClient] Connection attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}`)

      // Check if we're in a preview environment
      const inPreviewEnv = isPreviewEnvironment()

      if (inPreviewEnv) {
        console.log("[PusherClient] Using mock client in preview environment")
        return new MockPusherClient() as unknown as PusherClient
      }

      console.log("[PusherClient] Using real Pusher client in production environment")

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
      PusherClient.logToConsole = true

      // Create and return the Pusher client with improved configuration
      const client = new PusherClient(key, {
        cluster,
        enabledTransports: ["ws", "wss"],
        forceTLS: true,
        enableStats: true,
        disableStats: false,
        timeout: 15000, // Increase timeout to 15 seconds
        pongTimeout: 10000, // Increase pong timeout to 10 seconds
        activityTimeout: 30000, // Increase activity timeout to 30 seconds
        retryAfter: 1000, // Retry after 1 second on connection failure
        autoReconnect: true, // Ensure auto reconnect is enabled
      })

      // Add more detailed connection event listeners
      client.connection.bind("state_change", (states) => {
        console.log(`[PusherClient] Connection state changed from ${states.previous} to ${states.current}`)
      })

      client.connection.bind("error", (err) => {
        console.error("[PusherClient] Connection error:", err)
        // Try to reconnect immediately on error
        if (client.connection.state !== "connected" && client.connection.state !== "connecting") {
          console.log("[PusherClient] Attempting to reconnect after error...")
          client.connect()
        }
      })

      // Add connection event listeners for better debugging
      client.connection.bind("connected", () => {
        console.log("[PusherClient] Successfully connected to Pusher")
        connectionAttempts = 0 // Reset counter on successful connection
      })

      client.connection.bind("disconnected", () => {
        console.log("[PusherClient] Disconnected from Pusher")
      })

      return client
    } catch (error) {
      console.error(`[PusherClient] Failed to initialize Pusher client (attempt ${connectionAttempts}):`, error)

      // If we haven't reached the maximum number of attempts, try again
      if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
        console.log(`[PusherClient] Retrying in ${RECONNECTION_DELAY / 1000} seconds...`)
        await new Promise((resolve) => setTimeout(resolve, RECONNECTION_DELAY))
        return attemptConnection()
      }

      // If all attempts fail, return mock client as fallback
      console.log("[PusherClient] All connection attempts failed, falling back to mock client")
      return new MockPusherClient() as unknown as PusherClient
    }
  }

  return attemptConnection()
}
