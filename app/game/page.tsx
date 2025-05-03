"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { submitAnswer } from "@/app/actions"
import { usePusher } from "@/hooks/use-pusher"
import { EVENTS } from "@/lib/pusher-client"
import CountdownTimer from "@/components/countdown-timer"
import { toast } from "@/hooks/use-toast"

interface Question {
  id: string
  type: "baby-picture" | "text"
  question: string
  imageUrl?: string
  options: string[]
}

export default function GamePage() {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string>("")
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWaiting, setIsWaiting] = useState(false)
  const [timerActive, setTimerActive] = useState(false)
  const [timerReset, setTimerReset] = useState(0)
  const [timeIsUp, setTimeIsUp] = useState(false)
  const router = useRouter()
  const { gameChannel, isLoading: isPusherLoading } = usePusher()

  useEffect(() => {
    // Check if user is authenticated
    const playerName = localStorage.getItem("playerName")
    if (!playerName) {
      router.push("/join")
      return
    }

    // Fetch current question on initial load
    fetchCurrentQuestion()

    // Set up polling as a fallback for real-time updates
    const pollInterval = setInterval(() => {
      fetchCurrentQuestion()
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(pollInterval)
  }, [router])

  useEffect(() => {
    if (!gameChannel) return

    // Set up Pusher event listeners
    gameChannel.bind(EVENTS.QUESTION_UPDATE, (data: { question: Question }) => {
      setCurrentQuestion(data.question)
      setSelectedAnswer("")
      setHasSubmitted(false)
      setIsLoading(false)
      setIsWaiting(false)
      setTimeIsUp(false)
      setTimerReset((prev) => prev + 1) // Reset timer
      setTimerActive(true) // Start timer
    })

    // Listen for results announcement
    gameChannel.bind(EVENTS.SHOW_RESULTS, () => {
      router.push("/results")
    })

    // Listen for game reset
    gameChannel.bind(EVENTS.GAME_RESET, () => {
      setCurrentQuestion(null)
      setSelectedAnswer("")
      setHasSubmitted(false)
      setIsWaiting(true)
      setTimerActive(false)
      setTimeIsUp(false)
    })

    return () => {
      // Clean up event listeners
      gameChannel.unbind(EVENTS.QUESTION_UPDATE)
      gameChannel.unbind(EVENTS.SHOW_RESULTS)
      gameChannel.unbind(EVENTS.GAME_RESET)
    }
  }, [gameChannel, router])

  const fetchCurrentQuestion = async () => {
    try {
      const res = await fetch("/api/current-question")
      const data = await res.json()

      if (data.waiting) {
        setIsWaiting(true)
        setCurrentQuestion(null)
        setTimerActive(false)
      } else if (data.question) {
        // Only update if the question has changed
        if (!currentQuestion || currentQuestion.id !== data.question.id) {
          setCurrentQuestion(data.question)
          setIsWaiting(false)
          setTimeIsUp(false)
          setTimerReset((prev) => prev + 1) // Reset timer
          setTimerActive(true) // Start timer

          // If the user has already answered this question
          if (data.answered && data.selectedAnswer) {
            setSelectedAnswer(data.selectedAnswer)
            setHasSubmitted(true)
          } else {
            setSelectedAnswer("")
            setHasSubmitted(false)
          }
        }
      }
    } catch (err) {
      console.error("Error fetching current question:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedAnswer || !currentQuestion) return

    setHasSubmitted(true)

    try {
      await submitAnswer(currentQuestion.id, selectedAnswer)
      toast({
        title: "Answer submitted!",
        description: "You can change your answer until time runs out.",
      })
    } catch (error) {
      console.error("Failed to submit answer:", error)
      setHasSubmitted(false)
      toast({
        title: "Error",
        description: "Failed to submit your answer. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleTimeUp = () => {
    setTimeIsUp(true)
    if (selectedAnswer && !hasSubmitted && currentQuestion) {
      // Auto-submit if user selected but didn't submit
      handleSubmit()
    } else if (!selectedAnswer && currentQuestion) {
      toast({
        title: "Time's up!",
        description: "You didn't select an answer in time.",
        variant: "destructive",
      })
    }
  }

  if (isPusherLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-arcane-navy">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-arcane-blue/30 border-t-arcane-blue mx-auto"></div>
          <p className="text-lg text-arcane-gray">Loading question...</p>
        </div>
      </div>
    )
  }

  if (isWaiting || !currentQuestion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-arcane-navy p-4">
        <Card className="w-full max-w-md border-2 border-arcane-blue/50 bg-arcane-navy/80 text-center shadow-md">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-arcane-gray-light">Waiting for the game to start</h2>
            <p className="mt-2 text-arcane-gray">The host will start the game soon!</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-arcane-navy p-4">
      <Card className="w-full max-w-md border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold text-arcane-blue flex-1">{currentQuestion.question}</h2>
            <div className="ml-4 flex-shrink-0">
              <CountdownTimer duration={30} onTimeUp={handleTimeUp} isActive={timerActive} reset={timerReset} />
            </div>
          </div>

          {currentQuestion.type === "baby-picture" && currentQuestion.imageUrl && (
            <div className="mb-6 overflow-hidden rounded-lg">
              <img
                src={currentQuestion.imageUrl || "/placeholder.svg"}
                alt="Baby Picture"
                className="h-auto w-full object-cover"
              />
            </div>
          )}

          <div className="mb-6">
            <RadioGroup
              value={selectedAnswer}
              onValueChange={setSelectedAnswer}
              className="space-y-3"
              disabled={timeIsUp}
            >
              {currentQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className={`flex items-center rounded-lg border p-3 transition-colors ${
                    selectedAnswer === option
                      ? "border-arcane-blue bg-arcane-blue/10"
                      : "border-arcane-blue/20 bg-arcane-navy/50"
                  } ${timeIsUp ? "opacity-70" : ""}`}
                >
                  <RadioGroupItem value={option} id={`option-${index}`} className="text-arcane-blue" />
                  <Label htmlFor={`option-${index}`} className="ml-2 cursor-pointer w-full text-arcane-gray-light">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!selectedAnswer || timeIsUp}
            className={`w-full ${
              hasSubmitted && !timeIsUp
                ? "bg-arcane-gold hover:bg-arcane-gold/80 text-arcane-navy"
                : "bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy"
            } font-bold`}
          >
            {timeIsUp ? "Time's Up!" : hasSubmitted ? "Change Answer" : "Submit Answer"}
          </Button>

          {hasSubmitted && !timeIsUp && (
            <p className="text-center text-arcane-gold text-sm mt-2">
              Answer submitted! You can change it until time runs out.
            </p>
          )}

          {timeIsUp && (
            <p className="text-center text-arcane-gray text-sm mt-2">Time's up! Waiting for the next question...</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
