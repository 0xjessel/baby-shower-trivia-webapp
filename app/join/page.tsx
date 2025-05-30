"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { joinGame } from "@/app/actions"
import PlayerHeartbeat from "@/components/player-heartbeat"

// Add this export to disable static generation for this page
export const dynamic = "force-dynamic"

export default function JoinPage() {
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const [isReturningPlayer, setIsReturningPlayer] = useState(false)

  useEffect(() => {
    // Check if player is returning
    const playerName = localStorage.getItem("playerName")
    if (playerName) {
      setIsReturningPlayer(true)
      setName(playerName)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)

    try {
      const result = await joinGame(name)
      if (result.success) {
        // Store name in localStorage for client-side access
        localStorage.setItem("playerName", name)
        router.push("/game")
      } else {
        console.error("Failed to join game:", result.error)
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error("Failed to join game:", error)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-arcane-navy p-4">
      {/* Include heartbeat for returning players */}
      {isReturningPlayer && <PlayerHeartbeat />}

      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mb-6 rounded-lg overflow-hidden shadow-lg border-2 border-arcane-gold/50">
            <img
              src="/images/hero-banner.png"
              alt="Future of Piltover: Baby Jayce's League Challenge"
              className="w-full h-auto"
            />
          </div>
        </div>

        <Card className="w-full max-w-md border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-arcane-blue">Join Baby Jayce's League Challenge!</CardTitle>
            <CardDescription className="text-arcane-gray">Enter your name to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-arcane-gray-light">
                  Your Name
                </Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Joining..." : isReturningPlayer ? "Rejoin Game" : "Join Game"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
