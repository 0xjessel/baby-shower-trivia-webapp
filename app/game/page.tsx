"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { usePusher } from "@/hooks/use-pusher"
import { GAME_CHANNEL, EVENTS } from "@/lib/pusher-server"
import { PlayerHeartbeat } from "@/components/player-heartbeat"
import { useToast } from "@/hooks/use-toast"
import { PusherStatus } from "@/components/pusher-status"

export default function GamePage() {
  const [question, setQuestion] = useState<any>(null)
  const [customAnswers, setCustomAnswers] = useState<any[]>([])
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)
  const [gameStatus, setGameStatus] = useState<string>("waiting")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Initialize Pusher
  const { pusher, connectionState } = usePusher()

  // Function to fetch the current question
  const fetchCurrentQuestion = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/current-question")

      if (response.status === 401) {
        console.log("Authentication error: User not logged in")
        setAuthError(true)
        setError("You need to join the game first")
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()

      if (data.waiting) {
        setQuestion(null)
        setGameStatus(data.gameStatus || "waiting")
      } else {
        setQuestion(data.question)
        setCustomAnswers(data.customAnswers || [])
        setAnswered(data.answered || false)
        setSelectedAnswer(data.selectedAnswer || null)
        setGameStatus(data.gameStatus || "active")
      }
      setAuthError(false)
      setError(null)
    } catch (error) {
      console.error("Error fetching current question:", error)
      setError("Failed to load the current question. Please try refreshing the page.")
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch the current question on initial load
  useEffect(() => {
    fetchCurrentQuestion()
  }, [])

  // Redirect to join page if not authenticated
  useEffect(() => {
    if (authError) {
      // Add a small delay to ensure the user sees the message
      const timer = setTimeout(() => {
        router.push("/join")
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [authError, router])

  // Subscribe to Pusher events
  useEffect(() => {
    if (!pusher) return

    // Subscribe to the game channel
    const channel = pusher.subscribe(GAME_CHANNEL)

    // Listen for question updates
    channel.bind(EVENTS.QUESTION_UPDATE, (data: any) => {
      console.log("Received question update:", data)
      fetchCurrentQuestion()
    })

    // Listen for custom answers
    channel.bind(EVENTS.CUSTOM_ANSWER_ADDED, (data: any) => {
      if (data.questionId === question?.id) {
        setCustomAnswers((prev) => [...prev, data.customAnswer])
      }
    })

    // Listen for game reset
    channel.bind(EVENTS.GAME_RESET, () => {
      setQuestion(null)
      setCustomAnswers([])
      setSelectedAnswer(null)
      setAnswered(false)
      setGameStatus("waiting")
    })

    // Listen for show results
    channel.bind(EVENTS.SHOW_RESULTS, () => {
      setGameStatus("results")
      router.push("/results")
    })

    // Listen for game change
    channel.bind(EVENTS.GAME_CHANGE, () => {
      fetchCurrentQuestion()
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(GAME_CHANNEL)
    }
  }, [pusher, question, router])

  // Handle answer selection
  const handleAnswerSelect = async (answer: string) => {
    if (answered) return

    setSelectedAnswer(answer)

    try {
      const response = await fetch("/api/vote-counts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: question.id,
          selectedAnswer: answer,
          previousAnswer: null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update vote count")
      }
    } catch (error) {
      console.error("Error updating vote count:", error)
      toast({
        title: "Error",
        description: "Failed to update vote count",
        variant: "destructive",
      })
    }
  }

  // Handle answer submission
  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || answered) return

    try {
      const response = await fetch("/api/submit-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: question.id,
          answer: selectedAnswer,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit answer")
      }

      setAnswered(true)
      toast({
        title: "Success",
        description: "Your answer has been submitted!",
      })
    } catch (error) {
      console.error("Error submitting answer:", error)
      toast({
        title: "Error",
        description: "Failed to submit answer",
        variant: "destructive",
      })
    }
  }

  // Handle custom answer submission
  const handleCustomAnswer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const customAnswer = formData.get("customAnswer") as string

    if (!customAnswer.trim()) return

    try {
      const response = await fetch("/api/custom-answers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: question.id,
          answer: customAnswer,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to add custom answer")
      }

      // Clear the input
      e.currentTarget.reset()
    } catch (error) {
      console.error("Error adding custom answer:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add custom answer",
        variant: "destructive",
      })
    }
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-pulse h-6 w-3/4 bg-arcane-blue/20 rounded mx-auto mb-4"></div>
              <div className="animate-pulse h-32 w-full bg-arcane-blue/10 rounded mb-4"></div>
              <div className="animate-pulse h-10 w-full bg-arcane-blue/20 rounded mb-2"></div>
              <div className="animate-pulse h-10 w-full bg-arcane-blue/20 rounded mb-2"></div>
              <div className="animate-pulse h-10 w-full bg-arcane-blue/20 rounded mb-4"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render authentication error
  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-4 text-red-500">Authentication Required</h2>
              <p className="mb-4">You need to join the game first. Redirecting to join page...</p>
              <Button onClick={() => router.push("/join")} className="bg-arcane-blue hover:bg-arcane-blue/80">
                Join Game Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-4 text-red-500">Error</h2>
              <p className="mb-4">{error}</p>
              <Button onClick={fetchCurrentQuestion} className="bg-arcane-blue hover:bg-arcane-blue/80">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render waiting state
  if (!question || gameStatus === "waiting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-4">Waiting for the game to start...</h2>
              <p className="mb-4">The host will start the game soon. Please wait.</p>
              <div className="flex justify-center">
                <div className="animate-bounce bg-arcane-blue rounded-full p-2 w-12 h-12 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                  </svg>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="mt-4">
          <PusherStatus connectionState={connectionState} />
        </div>
        <PlayerHeartbeat />
      </div>
    )
  }

  // Render the question
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4">{question.question}</h2>

            {question.type === "baby-picture" && question.imageUrl && (
              <div className="mb-4">
                <img
                  src={question.imageUrl || "/placeholder.svg"}
                  alt="Baby"
                  className="rounded-lg mx-auto max-h-64 object-contain"
                />
              </div>
            )}

            <div className="space-y-2 mb-4">
              {/* Predefined options */}
              {question.options &&
                question.options.map((option: string, index: number) => (
                  <button
                    key={`option-${index}`}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedAnswer === option
                        ? "bg-arcane-blue text-white"
                        : "bg-arcane-navy/50 hover:bg-arcane-navy/70 text-arcane-gray-light"
                    } ${answered && selectedAnswer !== option ? "opacity-50" : ""}`}
                    onClick={() => handleAnswerSelect(option)}
                    disabled={answered}
                  >
                    {option}
                  </button>
                ))}

              {/* Custom answers */}
              {customAnswers.map((customAnswer) => (
                <button
                  key={customAnswer.id}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedAnswer === customAnswer.text
                      ? "bg-arcane-blue text-white"
                      : "bg-arcane-navy/50 hover:bg-arcane-navy/70 text-arcane-gray-light"
                  } ${answered && selectedAnswer !== customAnswer.text ? "opacity-50" : ""}`}
                  onClick={() => handleAnswerSelect(customAnswer.text)}
                  disabled={answered}
                >
                  {customAnswer.text}
                  <span className="text-xs block opacity-70">Added by: {customAnswer.addedBy}</span>
                </button>
              ))}
            </div>

            {/* Submit button */}
            {selectedAnswer && !answered && (
              <Button
                onClick={handleSubmitAnswer}
                className="w-full bg-arcane-gold hover:bg-arcane-gold/80 text-arcane-navy font-bold"
              >
                Submit Answer
              </Button>
            )}

            {/* Answered state */}
            {answered && (
              <div className="p-3 bg-green-900/20 text-green-400 rounded-lg">
                Your answer has been submitted: <strong>{selectedAnswer}</strong>
              </div>
            )}

            {/* Custom answer form */}
            {question.allowsCustomAnswers && !answered && (
              <form onSubmit={handleCustomAnswer} className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Don't see your answer? Add it!</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="customAnswer"
                    placeholder="Your answer..."
                    className="flex-1 p-2 rounded-lg border border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue"
                    required
                  />
                  <Button type="submit" className="bg-arcane-blue hover:bg-arcane-blue/80">
                    Add
                  </Button>
                </div>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="mt-4">
        <PusherStatus connectionState={connectionState} />
      </div>
      <PlayerHeartbeat />
    </div>
  )
}
