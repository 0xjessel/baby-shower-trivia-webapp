"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { submitAnswer, addCustomAnswer } from "@/app/actions"
import { usePusher } from "@/hooks/use-pusher"
import { EVENTS } from "@/lib/pusher-client"
import CountdownTimer from "@/components/countdown-timer"
import { toast } from "@/hooks/use-toast"
import { Users, Send } from "lucide-react"

interface Question {
  id: string
  type: "baby-picture" | "text"
  question: string
  imageUrl?: string
  options: string[]
}

interface CustomAnswer {
  id: string
  text: string
  addedBy: string
}

interface VoteCounts {
  [option: string]: number
}

export default function GamePage() {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string>("")
  const [submittedAnswer, setSubmittedAnswer] = useState<string>("")
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWaiting, setIsWaiting] = useState(true)
  const [timerActive, setTimerActive] = useState(false)
  const [timerReset, setTimerReset] = useState(0)
  const [timeIsUp, setTimeIsUp] = useState(false)
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({})
  const [totalVotes, setTotalVotes] = useState(0)
  const [customAnswers, setCustomAnswers] = useState<CustomAnswer[]>([])
  const [newCustomAnswer, setNewCustomAnswer] = useState("")
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false)
  const playerName = useRef<string>("")
  const router = useRouter()
  const { gameChannel, isLoading: isPusherLoading } = usePusher()

  // Memoize the fetchCurrentQuestion function to avoid recreating it on every render
  const fetchCurrentQuestion = useCallback(async () => {
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
          setCustomAnswers([]) // Reset custom answers for new question

          // Reset vote counts for new question
          const initialVoteCounts: VoteCounts = {}
          data.question.options.forEach((option: string) => {
            initialVoteCounts[option] = 0
          })
          setVoteCounts(initialVoteCounts)
          setTotalVotes(0)

          // If the user has already answered this question
          if (data.answered && data.selectedAnswer) {
            setSelectedAnswer(data.selectedAnswer)
            setSubmittedAnswer(data.selectedAnswer)
            setHasSubmitted(true)
          } else {
            setSelectedAnswer("")
            setSubmittedAnswer("")
            setHasSubmitted(false)
          }

          // Fetch initial vote counts
          fetchVoteCounts(data.question.id)

          // Fetch custom answers
          fetchCustomAnswers(data.question.id)
        }
      }
    } catch (err) {
      console.error("Error fetching current question:", err)
    } finally {
      setIsLoading(false)
    }
  }, [currentQuestion])

  // Fetch vote counts for the current question
  const fetchVoteCounts = async (questionId: string) => {
    try {
      const res = await fetch(`/api/vote-counts?questionId=${questionId}`)
      const data = await res.json()

      if (data.voteCounts) {
        setVoteCounts(data.voteCounts)
        setTotalVotes(data.totalVotes)
      }
    } catch (err) {
      console.error("Error fetching vote counts:", err)
    }
  }

  // Fetch custom answers for the current question
  const fetchCustomAnswers = async (questionId: string) => {
    try {
      const res = await fetch(`/api/custom-answers?questionId=${questionId}`)
      const data = await res.json()

      if (data.customAnswers) {
        setCustomAnswers(data.customAnswers)
      }
    } catch (err) {
      console.error("Error fetching custom answers:", err)
    }
  }

  useEffect(() => {
    // Check if user is authenticated
    const name = localStorage.getItem("playerName")
    if (!name) {
      router.push("/join")
      return
    }

    playerName.current = name

    // Fetch current question on initial load
    fetchCurrentQuestion()

    // Set up polling as a fallback for real-time updates
    const pollInterval = setInterval(() => {
      fetchCurrentQuestion()
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(pollInterval)
  }, [router, fetchCurrentQuestion])

  useEffect(() => {
    if (!gameChannel) return

    // Set up Pusher event listeners
    gameChannel.bind(EVENTS.QUESTION_UPDATE, (data: { question: Question }) => {
      setCurrentQuestion(data.question)
      setSelectedAnswer("")
      setSubmittedAnswer("")
      setHasSubmitted(false)
      setIsLoading(false)
      setIsWaiting(false)
      setTimeIsUp(false)
      setTimerReset((prev) => prev + 1) // Reset timer
      setTimerActive(true) // Start timer
      setCustomAnswers([]) // Reset custom answers for new question

      // Reset vote counts for new question
      const initialVoteCounts: VoteCounts = {}
      data.question.options.forEach((option) => {
        initialVoteCounts[option] = 0
      })
      setVoteCounts(initialVoteCounts)
      setTotalVotes(0)
    })

    // Listen for vote updates
    gameChannel.bind(EVENTS.VOTE_UPDATE, (data: { voteCounts: VoteCounts; totalVotes: number }) => {
      setVoteCounts(data.voteCounts)
      setTotalVotes(data.totalVotes)
    })

    // Listen for custom answer updates
    gameChannel.bind(EVENTS.CUSTOM_ANSWER_ADDED, (data: { customAnswer: CustomAnswer }) => {
      setCustomAnswers((prev) => [...prev, data.customAnswer])

      // Update vote counts to include the new custom answer
      setVoteCounts((prev) => ({
        ...prev,
        [data.customAnswer.text]: 0,
      }))
    })

    // Listen for results announcement
    gameChannel.bind(EVENTS.SHOW_RESULTS, () => {
      router.push("/results")
    })

    // Listen for game reset
    gameChannel.bind(EVENTS.GAME_RESET, () => {
      setCurrentQuestion(null)
      setSelectedAnswer("")
      setSubmittedAnswer("")
      setHasSubmitted(false)
      setIsWaiting(true)
      setTimerActive(false)
      setTimeIsUp(false)
      setVoteCounts({})
      setTotalVotes(0)
      setCustomAnswers([])
    })

    return () => {
      // Clean up event listeners
      gameChannel.unbind(EVENTS.QUESTION_UPDATE)
      gameChannel.unbind(EVENTS.VOTE_UPDATE)
      gameChannel.unbind(EVENTS.CUSTOM_ANSWER_ADDED)
      gameChannel.unbind(EVENTS.SHOW_RESULTS)
      gameChannel.unbind(EVENTS.GAME_RESET)
    }
  }, [gameChannel, router])

  const handleAnswerChange = (value: string) => {
    // If changing from a previously selected answer, decrement that count
    if (selectedAnswer && selectedAnswer !== value) {
      setVoteCounts((prev) => ({
        ...prev,
        [selectedAnswer]: Math.max(0, (prev[selectedAnswer] || 0) - 1),
      }))
    }

    // Increment the count for the newly selected answer
    setVoteCounts((prev) => ({
      ...prev,
      [value]: (prev[value] || 0) + 1,
    }))

    // Update total votes if this is a new selection
    if (!selectedAnswer) {
      setTotalVotes((prev) => prev + 1)
    }

    setSelectedAnswer(value)

    // If already submitted and user selects a different answer, allow resubmission
    if (hasSubmitted && !timeIsUp && value !== submittedAnswer) {
      setHasSubmitted(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedAnswer || !currentQuestion) return

    try {
      await submitAnswer(currentQuestion.id, selectedAnswer)
      setSubmittedAnswer(selectedAnswer)
      setHasSubmitted(true)
      toast({
        title: "Answer submitted!",
      })

      // We don't need to update vote counts here anymore as we're doing it in handleAnswerChange
    } catch (error) {
      console.error("Failed to submit answer:", error)
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

  // Update the handleAddCustomAnswer function to automatically select and submit the custom answer after it's added

  const handleAddCustomAnswer = async () => {
    if (!newCustomAnswer.trim() || !currentQuestion) return

    setIsSubmittingCustom(true)

    try {
      const result = await addCustomAnswer(currentQuestion.id, newCustomAnswer.trim())

      if (result.success && result.customAnswer) {
        setNewCustomAnswer("")
        toast({
          title: "Custom answer added!",
          description: "Your answer has been submitted.",
        })

        // Add the custom answer to the local state immediately
        const newCustomAnswerObj = result.customAnswer
        setCustomAnswers((prev) => [...prev, newCustomAnswerObj])

        // Set the newly added answer as the selected answer
        setSelectedAnswer(newCustomAnswerObj.text)

        // Update vote counts to include the new custom answer with 1 vote
        setVoteCounts((prev) => ({
          ...prev,
          [newCustomAnswerObj.text]: 1,
        }))

        // Update total votes
        setTotalVotes((prev) => prev + 1)

        // Submit the answer automatically
        await submitAnswer(currentQuestion.id, newCustomAnswerObj.text)
        setSubmittedAnswer(newCustomAnswerObj.text)
        setHasSubmitted(true)
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add custom answer.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to add custom answer:", error)
      toast({
        title: "Error",
        description: "Failed to add custom answer. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingCustom(false)
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

  // Combine predefined options with custom answers
  const allOptions = [...currentQuestion.options, ...customAnswers.map((ca) => ca.text)]

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
              onValueChange={handleAnswerChange}
              className="space-y-3"
              disabled={timeIsUp}
            >
              {allOptions.map((option, index) => {
                const voteCount = voteCounts[option] || 0
                const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0
                const isCustom = customAnswers.some((ca) => ca.text === option)
                const addedBy = isCustom ? customAnswers.find((ca) => ca.text === option)?.addedBy : null

                return (
                  <div
                    key={index}
                    className={`relative flex items-center rounded-lg border p-3 transition-colors ${
                      selectedAnswer === option
                        ? "border-arcane-blue bg-arcane-blue/10"
                        : "border-arcane-blue/20 bg-arcane-navy/50"
                    } ${timeIsUp ? "opacity-70" : ""} cursor-pointer`}
                    onClick={() => !timeIsUp && handleAnswerChange(option)}
                  >
                    {/* Background progress bar */}
                    <div
                      className="absolute inset-0 bg-arcane-gold/10 rounded-lg z-0"
                      style={{ width: `${percentage}%` }}
                    />

                    <RadioGroupItem value={option} id={`option-${index}`} className="text-arcane-blue z-10" />
                    <div className="ml-2 w-full z-10">
                      <Label htmlFor={`option-${index}`} className="text-arcane-gray-light cursor-pointer">
                        {option}
                      </Label>

                      {isCustom && addedBy && <p className="text-xs text-arcane-gold mt-0.5">Added by {addedBy}</p>}
                    </div>

                    {/* Vote count indicator */}
                    <div className="flex items-center text-xs text-arcane-gold ml-2 z-10">
                      <Users className="h-3 w-3 mr-1" />
                      <span>{voteCount}</span>
                    </div>
                  </div>
                )
              })}

              {/* Custom answer input field */}
              <div className="relative flex items-center rounded-lg border border-arcane-blue/20 bg-arcane-navy/50 p-3 transition-colors">
                <RadioGroupItem
                  value="__custom__"
                  id="option-custom"
                  className="text-arcane-blue z-10 opacity-0 absolute"
                  disabled
                />
                <div className="flex w-full items-center gap-2 z-10">
                  <Input
                    placeholder="Add your own answer..."
                    value={newCustomAnswer}
                    onChange={(e) => setNewCustomAnswer(e.target.value)}
                    className="border-none bg-transparent text-arcane-gray-light focus:ring-0 pl-8 h-auto"
                    disabled={isSubmittingCustom || timeIsUp}
                  />
                  <Button
                    onClick={handleAddCustomAnswer}
                    disabled={!newCustomAnswer.trim() || isSubmittingCustom || timeIsUp}
                    className="bg-arcane-gold hover:bg-arcane-gold/80 text-arcane-navy h-8 w-8 p-0 rounded-full"
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </RadioGroup>

            {totalVotes > 0 && (
              <div className="mt-2 text-xs text-arcane-gray flex items-center justify-end">
                <Users className="h-3 w-3 mr-1" />
                <span>Total votes: {totalVotes}</span>
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!selectedAnswer || timeIsUp || hasSubmitted}
            className="w-full bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold"
          >
            {timeIsUp ? "Time's Up!" : "Submit Answer"}
          </Button>

          {timeIsUp && (
            <p className="text-center text-arcane-gray text-sm mt-2">Time's up! Waiting for the next question...</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
