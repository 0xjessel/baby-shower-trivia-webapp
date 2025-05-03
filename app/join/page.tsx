"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { joinGame } from "@/app/actions"

export default function JoinPage() {
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-blue-50 p-4">
      <Card className="w-full max-w-md border-2 border-pink-200 shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-pink-600">Join the Baby Trivia!</CardTitle>
          <CardDescription>Enter your name to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-pink-600 hover:bg-pink-700" disabled={isSubmitting}>
              {isSubmitting ? "Joining..." : "Join Game"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
