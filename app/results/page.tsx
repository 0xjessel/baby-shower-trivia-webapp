"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { usePusher } from "@/hooks/use-pusher"
import { EVENTS } from "@/lib/pusher-client"
import PlayerHeartbeat from "@/components/player-heartbeat"
import confetti from "canvas-confetti"
import { Trophy, Medal, Award } from "lucide-react"

// Add this export to disable static generation for this page
export const dynamic = "force-dynamic"

interface ResultItem {
  questionId: string
  question: string
  imageUrl?: string
  correctAnswer: string
  yourAnswer: string
  isCorrect: boolean
}

export default function ResultsPage() {
  const [results, setResults] = useState<ResultItem[]>([])
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isWaiting, setIsWaiting] = useState(false)
  const [rank, setRank] = useState<number | null>(null)
  const [totalParticipants, setTotalParticipants] = useState(0)
  const router = useRouter()
  const { gameChannel, isLoading: isPusherLoading } = usePusher()

  useEffect(() => {
    // Ensure this code only runs in the browser
    if (typeof window === "undefined") return

    // Check if user is authenticated
    const playerName = localStorage.getItem("playerName")
    if (!playerName) {
      router.push("/join")
      return
    }

    fetchResults()
  }, [router])

  useEffect(() => {
    // Ensure this code only runs in the browser
    if (typeof window === "undefined" || !gameChannel) return

    // Set up Pusher event listeners
    // Listen for question updates - go back to game if a new question is shown
    gameChannel.bind(EVENTS.QUESTION_UPDATE, () => {
      router.push("/game")
    })

    // Listen for game reset
    gameChannel.bind(EVENTS.GAME_RESET, () => {
      router.push("/game")
    })

    return () => {
      // Clean up event listeners
      gameChannel.unbind(EVENTS.QUESTION_UPDATE)
      gameChannel.unbind(EVENTS.GAME_RESET)
    }
  }, [gameChannel, router])

  // Celebration effect for top 3 players
  useEffect(() => {
    if (rank === 1) {
      // Gold celebration for 1st place
      const duration = 5 * 1000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)

        // Gold confetti
        confetti({
          ...defaults,
          particleCount,
          origin: { x: Math.random(), y: Math.random() * 0.5 },
          colors: ["#FFD700", "#FFC800", "#FFDF00"],
        })
      }, 250)
    } else if (rank === 2) {
      // Silver celebration for 2nd place
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#C0C0C0", "#D3D3D3", "#A9A9A9"],
      })
    } else if (rank === 3) {
      // Bronze celebration for 3rd place
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.7 },
        colors: ["#CD7F32", "#B87333", "#D2691E"],
      })
    }
  }, [rank])

  const fetchResults = async () => {
    try {
      const res = await fetch("/api/results")

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()

      if (data.waiting) {
        setIsWaiting(true)
        setIsLoading(false)
      } else if (data.results) {
        setResults(data.results)
        setScore({
          correct: data.results.filter((r: ResultItem) => r.isCorrect).length,
          total: data.results.length,
        })
        setRank(data.rank)
        setTotalParticipants(data.totalParticipants)
        setIsWaiting(false)
        setIsLoading(false)
      }
    } catch (err) {
      console.error("Error fetching results:", err)
      setIsLoading(false)
    }
  }

  const getRankDisplay = () => {
    if (!rank) return null

    if (rank === 1) {
      return (
        <div className="flex items-center justify-center gap-2 text-yellow-400 animate-pulse">
          <Trophy className="h-8 w-8" />
          <span className="text-2xl font-bold">1st Place!</span>
        </div>
      )
    } else if (rank === 2) {
      return (
        <div className="flex items-center justify-center gap-2 text-gray-300">
          <Medal className="h-7 w-7" />
          <span className="text-xl font-bold">2nd Place</span>
        </div>
      )
    } else if (rank === 3) {
      return (
        <div className="flex items-center justify-center gap-2 text-amber-700">
          <Award className="h-6 w-6" />
          <span className="text-lg font-bold">3rd Place</span>
        </div>
      )
    } else {
      return (
        <div className="text-arcane-gray">
          Rank: {rank} of {totalParticipants}
        </div>
      )
    }
  }

  if (isPusherLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-arcane-navy">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-arcane-blue/30 border-t-arcane-blue mx-auto"></div>
          <p className="text-lg text-arcane-gray">Loading results...</p>
        </div>
      </div>
    )
  }

  if (isWaiting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-arcane-navy p-4">
        <Card className="w-full max-w-md border-2 border-arcane-blue/50 bg-arcane-navy/80 text-center shadow-md">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-arcane-gray-light">Waiting for results</h2>
            <p className="mt-2 text-arcane-gray">The host will reveal the results soon!</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-arcane-navy p-4">
      {/* Include the heartbeat component */}
      <PlayerHeartbeat />

      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-arcane-blue">Your Results</h1>
          <p className="mt-2 text-lg text-arcane-gray">
            You got {score.correct} out of {score.total} correct!
          </p>

          {/* Display rank with animation for top 3 */}
          <div className="mt-4 mb-6">{getRankDisplay()}</div>
        </div>

        <div className="space-y-4">
          {results.map((result, index) => (
            <Card
              key={index}
              className={`border-2 shadow-md bg-arcane-navy/80 ${
                result.isCorrect ? "border-green-500/50" : "border-red-500/50"
              }`}
            >
              <CardContent className="p-4">
                <h3 className="font-semibold text-arcane-gray-light">{result.question}</h3>

                {result.imageUrl && (
                  <div className="my-3 overflow-hidden rounded-lg">
                    <img
                      src={result.imageUrl || "/placeholder.svg"}
                      alt="Baby Picture"
                      className="h-auto w-full object-cover"
                    />
                  </div>
                )}

                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    <span className="font-medium text-arcane-gray">Correct answer:</span>{" "}
                    <span className="text-green-500">{result.correctAnswer}</span>
                  </p>
                  <p>
                    <span className="font-medium text-arcane-gray">Your answer:</span>{" "}
                    <span className={result.isCorrect ? "text-green-500" : "text-red-500"}>{result.yourAnswer}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Button
            onClick={() => router.push("/")}
            className="bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}
