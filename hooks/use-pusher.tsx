"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useRef } from "react"
import type { Channel } from "pusher-js"
import type PusherClient from "pusher-js"
import { createPusherClient, GAME_CHANNEL } from "@/lib/pusher-client"

type PusherContextType = {
  gameChannel: Channel | null
  isLoading: boolean
  isConnected: boolean
  connectionStatus: "connecting" | "connected" | "disconnected" | "error" | "polling"
}

const PusherContext = createContext<PusherContextType>({
  gameChannel: null,
  isLoading: true,
  isConnected: false,
  connectionStatus: "connecting",
})

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

export function PusherProvider({ children }: { children: React.ReactNode }) {
  const [gameChannel, setGameChannel] = useState<Channel | null>(null)
  const [pusherClient, setPusherClient] = useState<PusherClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error" | "polling"
  >("connecting")
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const MAX_RECONNECT_ATTEMPTS = 5

  useEffect(() => {
    let isMounted = true
    const isPreviewEnv = isPreviewEnvironment()

    const initializePusher = async () => {
      try {
        console.log("[PUSHER] Initializing Pusher client...")
        setConnectionStatus("connecting")

        const client = await createPusherClient()

        if (!isMounted) return

        setPusherClient(client)
        console.log("[PUSHER] Subscribing to game channel...")
        const channel = client.subscribe(GAME_CHANNEL)

        // Add connection status event listeners if this is a real Pusher client
        if ("connection" in client) {
          client.connection.bind("connected", () => {
            console.log("[PUSHER] Connected successfully!")
            if (isMounted) {
              setIsConnected(true)
              setConnectionStatus("connected")
              reconnectAttemptsRef.current = 0 // Reset reconnect attempts on successful connection
            }
          })

          client.connection.bind("disconnected", () => {
            console.log("[PUSHER] Disconnected!")
            if (isMounted) {
              setIsConnected(false)
              setConnectionStatus("disconnected")

              // Try to reconnect if not in preview mode
              if (!isPreviewEnv && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                scheduleReconnect()
              }
            }
          })

          client.connection.bind("error", (err: any) => {
            console.error("[PUSHER] Connection error:", err)
            if (isMounted) {
              setIsConnected(false)
              setConnectionStatus("error")

              // Try to reconnect if not in preview mode
              if (!isPreviewEnv && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                scheduleReconnect()
              }
            }
          })
        } else {
          // This is our mock client for preview mode
          console.log("[PUSHER] Using mock client (preview mode)")
          setConnectionStatus("polling")
        }

        setGameChannel(channel)
        setIsConnected(true)
        setIsLoading(false)

        // Debug channel binding
        if (channel.bind) {
          const originalBind = channel.bind
          channel.bind = function (eventName: string, callback: Function) {
            console.log(`[PUSHER] Binding to event "${eventName}" on channel "${GAME_CHANNEL}"`)
            return originalBind.call(this, eventName, callback)
          }
        }
      } catch (error) {
        console.error("[PUSHER] Error initializing Pusher:", error)
        if (isMounted) {
          setIsConnected(false)
          setIsLoading(false)
          setConnectionStatus(isPreviewEnv ? "polling" : "error")
        }
      }
    }

    const scheduleReconnect = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      reconnectAttemptsRef.current += 1
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000) // Exponential backoff with max 30s

      console.log(`[PUSHER] Scheduling reconnect attempt ${reconnectAttemptsRef.current} in ${delay}ms`)

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`[PUSHER] Attempting to reconnect (attempt ${reconnectAttemptsRef.current})`)
        cleanupPusher()
        initializePusher()
      }, delay)
    }

    const cleanupPusher = () => {
      if (pusherClient) {
        console.log("[PUSHER] Cleaning up Pusher connection")
        pusherClient.unsubscribe(GAME_CHANNEL)
        if ("disconnect" in pusherClient) {
          pusherClient.disconnect()
        }
      }
    }

    initializePusher()

    return () => {
      isMounted = false

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      cleanupPusher()
    }
  }, [])

  return (
    <PusherContext.Provider value={{ gameChannel, isLoading, isConnected, connectionStatus }}>
      {children}
    </PusherContext.Provider>
  )
}

export function usePusher() {
  return useContext(PusherContext)
}
