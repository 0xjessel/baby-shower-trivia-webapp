"use client"

import { useEffect } from "react"

export function PlayerHeartbeat() {
  useEffect(() => {
    if (typeof window === "undefined") return

    const playerName = localStorage.getItem("playerName")
    if (!playerName) return

    // Send heartbeat every 30 seconds
    const sendHeartbeat = async () => {
      try {
        await fetch("/api/player-heartbeat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ playerName }),
        })
      } catch (error) {
        console.error("Failed to send heartbeat:", error)
      }
    }

    // Send initial heartbeat
    sendHeartbeat()

    // Set up interval for regular heartbeats
    const intervalId = setInterval(sendHeartbeat, 30000)

    return () => clearInterval(intervalId)
  }, [])

  return null
}

// Also provide a default export for compatibility
export default PlayerHeartbeat
