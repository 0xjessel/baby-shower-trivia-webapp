"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VictoryOverlayProps {
  onDismiss?: () => void
}

export function VictoryOverlay({ onDismiss }: VictoryOverlayProps) {
  const [visible, setVisible] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    // Fade in on mount
    const fadeInTimeout = setTimeout(() => {
      setVisible(true)
    }, 100)

    // Auto-dismiss after 3 seconds
    const autoDismissTimeout = setTimeout(() => {
      handleDismiss()
    }, 3000)

    return () => {
      clearTimeout(fadeInTimeout)
      clearTimeout(autoDismissTimeout)
    }
  }, [])

  const handleDismiss = () => {
    setFadeOut(true)

    // Wait for fade out animation to complete before removing from DOM
    setTimeout(() => {
      if (onDismiss) onDismiss()
    }, 500)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      } ${fadeOut ? "opacity-0" : ""}`}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20"
        onClick={handleDismiss}
      >
        <X className="h-6 w-6" />
        <span className="sr-only">Close</span>
      </Button>

      <div className="relative max-w-md w-full mx-auto p-4">
        <img
          src="/images/victory-screen.png"
          alt="Victory!"
          className={`w-full h-auto rounded-lg shadow-2xl transition-all duration-700 ${
            visible ? "scale-100" : "scale-90"
          } ${fadeOut ? "scale-110 opacity-0" : ""}`}
        />
      </div>
    </div>
  )
}
