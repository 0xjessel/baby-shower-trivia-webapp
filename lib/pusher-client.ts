"use client"

import PusherClient from "pusher-js"

// Event names
export const EVENTS = {
  QUESTION_UPDATE: "question-update",
  NEW_QUESTION: "new-question", // Add this line
  SHOW_RESULTS: "show-results",
  GAME_RESET: "game-reset",
  VOTE_UPDATE: "vote-update",
  CUSTOM_ANSWER_ADDED: "custom-answer-added",
  GAME_CHANGE: "game-change",
}

// Channel names
export const GAME_CHANNEL = "game-channel"

// Maximum number of connection attempts
const MAX_CONNECTION_ATTEMPTS = 5
// Delay between reconnection attempts (in ms)
const RECONNECTION_DELAY = 2000

// Function to create a Pusher client by fetching configuration from the API
export async function createPusherClient() {
  let connectionAttempts = 0

  const attemptConnection = async (): Promise<PusherClient> => {
    try {
      connectionAttempts++
      console.log(`[PusherClient] Connection attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}`)

      console.log("[PusherClient] Using real Pusher client")

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

      // Add debug logs for channel subscriptions and events
      const originalSubscribe = client.subscribe
      client.subscribe = function (channelName) {
        console.log(`[PusherClient] Subscribing to channel: ${channelName}`)
        const channel = originalSubscribe.call(this, channelName)

        // Wrap the bind method to log event bindings
        const originalBind = channel.bind
        channel.bind = function (eventName, callback) {
          console.log(`[PusherClient] Binding to event "${eventName}" on channel "${channelName}"`)
          return originalBind.call(this, eventName, callback)
        }

        return channel
      }

      return client
    } catch (error) {
      console.error(`[PusherClient] Failed to initialize Pusher client (attempt ${connectionAttempts}):`, error)

      // If we haven't reached the maximum number of attempts, try again
      if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
        console.log(`[PusherClient] Retrying in ${RECONNECTION_DELAY / 1000} seconds...`)
        await new Promise((resolve) => setTimeout(resolve, RECONNECTION_DELAY))
        return attemptConnection()
      }

      // If all attempts fail, throw the error
      throw error
    }
  }

  return attemptConnection()
}
