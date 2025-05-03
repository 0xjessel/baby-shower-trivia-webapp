"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import type { Channel } from "pusher-js"
import type PusherClient from "pusher-js"
import { createPusherClient, GAME_CHANNEL } from "@/lib/pusher-client"

type PusherContextType = {
  gameChannel: Channel | null
  isLoading: boolean
  isConnected: boolean
}

const PusherContext = createContext<PusherContextType>({
  gameChannel: null,
  isLoading: true,
  isConnected: false,
})

export function PusherProvider({ children }: { children: React.ReactNode }) {
  const [gameChannel, setGameChannel] = useState<Channel | null>(null)
  const [pusherClient, setPusherClient] = useState<PusherClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    let isMounted = true

    const initializePusher = async () => {
      try {
        console.log("[PUSHER] Initializing Pusher client...")
        const client = await createPusherClient()

        if (isMounted) {
          setPusherClient(client)
          console.log("[PUSHER] Subscribing to game channel...")
          const channel = client.subscribe(GAME_CHANNEL)

          // Add connection status event listeners if this is a real Pusher client
          if ("connection" in client) {
            client.connection.bind("connected", () => {
              console.log("[PUSHER] Connected successfully!")
              if (isMounted) setIsConnected(true)
            })

            client.connection.bind("disconnected", () => {
              console.log("[PUSHER] Disconnected!")
              if (isMounted) setIsConnected(false)
            })

            client.connection.bind("error", (err: any) => {
              console.error("[PUSHER] Connection error:", err)
              if (isMounted) setIsConnected(false)
            })
          } else {
            // This is our mock client for preview mode
            console.log("[PUSHER] Using mock client (preview mode)")
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
        }
      } catch (error) {
        console.error("[PUSHER] Error initializing Pusher:", error)
        if (isMounted) {
          setIsConnected(false)
          setIsLoading(false)
        }
      }
    }

    initializePusher()

    return () => {
      isMounted = false
      if (pusherClient) {
        console.log("[PUSHER] Cleaning up Pusher connection")
        pusherClient.unsubscribe(GAME_CHANNEL)
        if ("disconnect" in pusherClient) {
          pusherClient.disconnect()
        }
      }
    }
  }, [])

  return <PusherContext.Provider value={{ gameChannel, isLoading, isConnected }}>{children}</PusherContext.Provider>
}

export function usePusher() {
  return useContext(PusherContext)
}
