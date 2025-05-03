"use client"

import { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"

interface CountdownTimerProps {
  duration: number // in seconds
  onTimeUp: () => void
  isActive: boolean
  reset: number // increment this to reset the timer
}

export default function CountdownTimer({ duration, onTimeUp, isActive, reset }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Calculate percentage for progress bar
  const percentage = Math.max(0, Math.min(100, (timeLeft / duration) * 100))

  // Determine color based on time left
  const getColor = () => {
    if (timeLeft > duration * 0.6) return "text-arcane-blue"
    if (timeLeft > duration * 0.3) return "text-arcane-gold"
    return "text-red-500"
  }

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Reset timer when reset prop changes or when isActive changes to true
  useEffect(() => {
    if (isActive) {
      setTimeLeft(duration)
      startTimeRef.current = Date.now()

      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      // Set up a new interval that runs every 100ms for smoother updates
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
          const newTimeLeft = Math.max(0, duration - elapsed)

          setTimeLeft(newTimeLeft)

          if (newTimeLeft <= 0) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
            onTimeUp()
          }
        }
      }, 100)
    } else {
      // Clear interval when timer is not active
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [reset, isActive, duration, onTimeUp])

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      {/* Circular background */}
      <div className="absolute inset-0 rounded-full bg-arcane-navy border-2 border-arcane-blue/20"></div>

      {/* Progress circle */}
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          className="text-arcane-navy/30 stroke-current"
          strokeWidth="8"
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
        />
        <circle
          className={cn("stroke-current transition-all duration-100", getColor())}
          strokeWidth="8"
          strokeLinecap="round"
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          strokeDasharray={`${2 * Math.PI * 40}`}
          strokeDashoffset={`${2 * Math.PI * 40 * (1 - percentage / 100)}`}
        />
      </svg>

      {/* Timer text */}
      <div className={cn("text-xl font-bold z-10", getColor())}>{timeLeft}</div>
    </div>
  )
}
