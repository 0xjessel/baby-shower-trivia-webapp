"use client"

import { useEffect, useState } from "react"
import { usePusher } from "@/hooks/use-pusher"

export function PusherStatus() {
  const { gameChannel, isLoading, isConnected } = usePusher()
  const [status, setStatus] = useState<"connecting" | "connected" | "error" | "preview">("connecting")
  const [isPreview, setIsPreview] = useState(false)

  useEffect(() => {
    // Check if we're in a preview environment
    const hostname = window.location.hostname
    const isPreviewEnv = hostname === "localhost" || hostname.includes("vercel.app")
    setIsPreview(isPreviewEnv)

    if (isPreviewEnv) {
      setStatus("preview")
    } else if (isLoading) {
      setStatus("connecting")
    } else if (isConnected) {
      setStatus("connected")
    } else {
      setStatus("error")
    }
  }, [gameChannel, isLoading, isConnected])

  return (
    <div className="fixed bottom-2 right-2 text-xs px-2 py-1 rounded-full flex items-center gap-1 bg-arcane-navy/80 border border-arcane-blue/20">
      <div
        className={`w-2 h-2 rounded-full ${
          status === "connected"
            ? "bg-green-500"
            : status === "preview"
              ? "bg-arcane-blue"
              : status === "connecting"
                ? "bg-arcane-gold"
                : "bg-red-500"
        }`}
      />
      <span className="text-arcane-gray">
        {status === "connected"
          ? "Realtime connected"
          : status === "preview"
            ? "Preview mode (polling)"
            : status === "connecting"
              ? "Connecting..."
              : "Connection error"}
      </span>
    </div>
  )
}
