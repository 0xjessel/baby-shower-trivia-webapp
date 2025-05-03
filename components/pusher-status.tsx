"use client"

import { useEffect, useState } from "react"
import { usePusher } from "@/hooks/use-pusher"

export function PusherStatus() {
  const { gameChannel, isLoading } = usePusher()
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting")

  useEffect(() => {
    if (isLoading) {
      setStatus("connecting")
    } else if (gameChannel) {
      setStatus("connected")
    } else {
      setStatus("error")
    }
  }, [gameChannel, isLoading])

  return (
    <div className="fixed bottom-2 right-2 text-xs px-2 py-1 rounded-full flex items-center gap-1">
      <div
        className={`w-2 h-2 rounded-full ${
          status === "connected" ? "bg-green-500" : status === "connecting" ? "bg-yellow-500" : "bg-red-500"
        }`}
      />
      <span className="text-gray-600">
        {status === "connected" ? "Realtime connected" : status === "connecting" ? "Connecting..." : "Connection error"}
      </span>
    </div>
  )
}
