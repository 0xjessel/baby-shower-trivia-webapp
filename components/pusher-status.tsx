"use client"

import { useEffect, useState } from "react"
import { usePusher } from "@/hooks/use-pusher"

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

export function PusherStatus() {
  const { connectionStatus, isLoading, isConnected } = usePusher()
  const [isPreview, setIsPreview] = useState(false)

  useEffect(() => {
    // Check if we're in a preview environment
    setIsPreview(isPreviewEnvironment())
  }, [])

  return (
    <div className="fixed bottom-2 right-2 text-xs px-2 py-1 rounded-full flex items-center gap-1 bg-arcane-navy/80 border border-arcane-blue/20">
      <div
        className={`w-2 h-2 rounded-full ${
          connectionStatus === "connected"
            ? "bg-green-500"
            : connectionStatus === "polling"
              ? "bg-arcane-blue"
              : connectionStatus === "connecting"
                ? "bg-arcane-gold"
                : "bg-red-500"
        }`}
      />
      <span className="text-arcane-gray">
        {connectionStatus === "connected"
          ? "Realtime connected"
          : connectionStatus === "polling"
            ? "Preview mode (polling)"
            : connectionStatus === "connecting"
              ? "Connecting..."
              : connectionStatus === "disconnected"
                ? "Disconnected (retrying)"
                : "Connection error"}
      </span>
    </div>
  )
}
