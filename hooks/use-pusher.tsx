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
        const client = await createPusherClient()

        if (isMounted) {
          setPusherClient(client)
          const channel = client.subscribe(GAME_CHANNEL)
          setGameChannel(channel)
          setIsConnected(true)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error initializing Pusher:", error)
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
        pusherClient.unsubscribe(GAME_CHANNEL)
        pusherClient.disconnect()
      }
    }
  }, [])

  return <PusherContext.Provider value={{ gameChannel, isLoading, isConnected }}>{children}</PusherContext.Provider>
}

export function usePusher() {
  return useContext(PusherContext)
}
