"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { usePusher } from "@/hooks/use-pusher"
import { EVENTS } from "@/lib/pusher-client"

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
  const router = useRouter()
  const { gameChannel, isLoading: isPusherLoading } = usePusher()

  useEffect(() => {
    // Check if user is authenticated
    const playerName = localStorage.getItem("playerName")
    if (!playerName) {
      router.push("/join")
      return
    }

    fetchResults()
  }, [router])

  useEffect(() => {
    if (!gameChannel) return

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

  const fetchResults = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/results")
      const data = await res.json()

      if (data.waiting) {
        setIsWaiting(true)
      } else if (data.results) {
        setResults(data.results)
        setScore({
          correct: data.results.filter((r: ResultItem) => r.isCorrect).length,
          total: data.results.length,
        })
        setIsWaiting(false)
      }
    } catch (err) {
      console.error("Error fetching results:", err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isPusherLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-pink-50 to-blue-50">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600 mx-auto"></div>
          <p className="text-lg text-gray-600">Loading results...</p>
        </div>
      </div>
    )
  }

  if (isWaiting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-pink-50 to-blue-50 p-4">
        <Card className="w-full max-w-md border-2 border-pink-200 text-center shadow-md">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-gray-800">Waiting for results</h2>
            <p className="mt-2 text-gray-600">The host will reveal the results soon!</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-blue-50 p-4">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-pink-600">Your Results</h1>
          <p className="mt-2 text-lg text-gray-600">
            You got {score.correct} out of {score.total} correct!
          </p>
        </div>

        <div className="space-y-4">
          {results.map((result, index) => (
            <Card
              key={index}
              className={`border-2 shadow-md ${result.isCorrect ? "border-green-200" : "border-red-200"}`}
            >
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800">{result.question}</h3>

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
                    <span className="font-medium text-gray-600">Correct answer:</span>{" "}
                    <span className="text-green-600">{result.correctAnswer}</span>
                  </p>
                  <p>
                    <span className="font-medium text-gray-600">Your answer:</span>{" "}
                    <span className={result.isCorrect ? "text-green-600" : "text-red-600"}>{result.yourAnswer}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Button onClick={() => router.push("/")} className="bg-pink-600 hover:bg-pink-700">
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}
