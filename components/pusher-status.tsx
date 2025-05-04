"use client"
import { usePusher } from "@/hooks/use-pusher"

export function PusherStatus() {
  const { connectionStatus, isLoading, isConnected } = usePusher()

  return (
    <div className="fixed bottom-2 right-2 text-xs px-2 py-1 rounded-full flex items-center gap-1 bg-arcane-navy/80 border border-arcane-blue/20">
      <div
        className={`w-2 h-2 rounded-full ${
          connectionStatus === "connected"
            ? "bg-green-500"
            : connectionStatus === "connecting"
              ? "bg-arcane-gold"
              : "bg-red-500"
        }`}
      />
      <span className="text-arcane-gray">
        {connectionStatus === "connected"
          ? "Realtime connected"
          : connectionStatus === "connecting"
            ? "Connecting..."
            : connectionStatus === "disconnected"
              ? "Disconnected (retrying)"
              : "Connection error"}
      </span>
    </div>
  )
}
