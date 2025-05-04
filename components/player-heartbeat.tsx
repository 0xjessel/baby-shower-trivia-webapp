"use client"

import { useEffect, useRef } from "react"

function PlayerHeartbeatComponent() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Send a heartbeat immediately
    sendHeartbeat()

    // Set up interval to send heartbeats every 30 seconds
    intervalRef.current = setInterval(sendHeartbeat, 30000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const sendHeartbeat = async () => {
    try {
      await fetch("/api/player-heartbeat", {
        method: "POST",
        headers: {
          "Cache-Control": "no-cache",
        },
      })
    } catch (error) {
      console.error("Failed to send heartbeat:", error)
    }
  }

  // This component doesn't render anything
  return null
}

// Export both as named and default export
export const PlayerHeartbeat = PlayerHeartbeatComponent
export default PlayerHeartbeatComponent
