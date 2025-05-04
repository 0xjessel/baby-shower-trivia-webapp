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
import PlayerHeartbeat from "@/components/player-heartbeat"

// Add this export to disable static generation for this page
export const dynamic = "force-dynamic"

interface Question {
  id: string
  type: "baby-picture" | "text"
  question: string
  imageUrl?: string
  options: string[]
  allowsCustomAnswers?: boolean
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
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  const [playerName, setPlayerName] = useState<string>("")
  const playerNameRef = useRef<string>("")
  const router = useRouter()
  const { gameChannel, isConnected, isLoading: isPusherLoading } = usePusher()

  // Track the last vote update we received to avoid duplicates
  const lastVoteUpdateId = useRef<string | null>(null)

  // Track the current question ID for cleanup
  const currentQuestionRef = useRef<string | null>(null)

  // Add a new state variable to track if the user has added a custom answer
  const [hasAddedCustomAnswer, setHasAddedCustomAnswer] = useState(false)

  // Fetch current question
  const fetchCurrentQuestion = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log("Fetching current question...")

      const res = await fetch("/api/current-question", {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`)
      }

      const data = await res.json()
      console.log("Current question API response:", data) // Add this debug line

      if (data.waiting) {
        console.log("Waiting for game to start, status:", data.gameStatus)
        setIsWaiting(true)
        setCurrentQuestion(null)
        setTimerActive(false)
        currentQuestionRef.current = null
      } else if (data.question) {
        // Check if this is a new question
        const isNewQuestion = !currentQuestion || currentQuestion.id !== data.question.id

        if (isNewQuestion) {
          console.log("New question received:", data.question.id)
          setCurrentQuestion(data.question)
          setIsWaiting(false)
          setTimeIsUp(false)
          setTimerReset((prev) => prev + 1)
          setTimerActive(true)
          setCustomAnswers(data.customAnswers || [])
          currentQuestionRef.current = data.question.id
          setHasAddedCustomAnswer(false) // Reset for new question

          // Reset vote counts for new question
          const initialVoteCounts: VoteCounts = {}
          data.question.options.forEach((option: string) => {
            initialVoteCounts[option] = 0
          })

          // Add initial vote counts for custom answers too
          if (data.customAnswers) {
            data.customAnswers.forEach((ca: CustomAnswer) => {
              initialVoteCounts[ca.text] = 0
            })
          }

          setVoteCounts(initialVoteCounts)
          setTotalVotes(0)

          // If the user has already answered this question
          if (data.answered && data.selectedAnswer) {
            console.log("User already answered:", data.selectedAnswer)
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
        } else {
          // Same question, just check if the game state has changed
          if (data.gameStatus === "results" && !timeIsUp) {
            console.log("Game state changed to results")
            setTimeIsUp(true)
          }

          // Update custom answers if needed
          if (data.customAnswers && data.customAnswers.length !== customAnswers.length) {
            setCustomAnswers(data.customAnswers)
            fetchVoteCounts(data.question.id)
          }
        }
      }
    } catch (err) {
      console.error("Error fetching current question:", err)
    } finally {
      setIsLoading(false)
    }
  }, [currentQuestion, customAnswers.length])

  // Fetch vote counts for the current question
  const fetchVoteCounts = useCallback(async (questionId: string) => {
    if (!questionId) return

    try {
      console.log("Fetching vote counts for question:", questionId)
      const res = await fetch(`/api/vote-counts?questionId=${questionId}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`)
      }

      const data = await res.json()

      if (data.voteCounts && questionId === currentQuestionRef.current) {
        console.log("Vote counts received:", data.voteCounts, "Total:", data.totalVotes)

        // Generate a unique ID for this update
        const updateId = `${questionId}-${data.timestamp || Date.now()}`

        // Only update if this is different from the last update we processed
        if (updateId !== lastVoteUpdateId.current) {
          setVoteCounts(data.voteCounts)
          setTotalVotes(data.totalVotes)
          lastVoteUpdateId.current = updateId
        }
      }
    } catch (err) {
      console.error("Error fetching vote counts:", err)
    }
  }, [])

  // Initial setup - fetch question and set up authentication
  useEffect(() => {
    // Ensure this code only runs in the browser
    if (typeof window === "undefined") return

    // Check if user is authenticated
    const name = localStorage.getItem("playerName")
    if (!name) {
      router.push("/join")
      return
    }

    playerNameRef.current = name
    setPlayerName(name) // Add this line to set the player name state

    // Fetch current question on initial load
    fetchCurrentQuestion()
  }, [router, fetchCurrentQuestion])

  // Set up Pusher event listeners
  useEffect(() => {
    if (!gameChannel) return

    console.log("Setting up Pusher event listeners")

    // Listen for question updates
    gameChannel.bind(EVENTS.QUESTION_UPDATE, (data: { question: Question; timestamp?: number }) => {
      console.log("Received question update via Pusher:", data.question.id)

      // Instead of just fetching the current question, we need to reset state and fetch the new question
      setCurrentQuestion(null)
      setSelectedAnswer("")
      setSubmittedAnswer("")
      setHasSubmitted(false)
      setIsWaiting(false) // Set to false immediately to show loading state
      setTimerActive(false)
      setTimeIsUp(false)
      setVoteCounts({})
      setTotalVotes(0)
      setCustomAnswers([])
      setHasAddedCustomAnswer(false) // Reset this state for new questions
      currentQuestionRef.current = null
      lastVoteUpdateId.current = null

      // Add a small delay before fetching to ensure the database has updated
      setTimeout(() => {
        // Fetch the new question
        fetchCurrentQuestion()
      }, 500)
    })

    // Listen for vote updates
    gameChannel.bind(
      EVENTS.VOTE_UPDATE,
      (data: {
        voteCounts: VoteCounts
        totalVotes: number
        questionId: string
        timestamp: string
        source?: string
      }) => {
        console.log("Vote update received via Pusher:", data)

        // Only update if this is for the current question
        if (currentQuestionRef.current && data.questionId === currentQuestionRef.current) {
          // Check if this is a vote from another guest
          const isFromOtherGuest = data.source !== "submitAnswer" || submittedAnswer !== selectedAnswer

          if (isFromOtherGuest) {
            console.log("📊 GUEST VOTE UPDATE: Received vote from another guest", {
              questionId: data.questionId,
              totalVotes: data.totalVotes,
              timestamp: data.timestamp,
              voteCounts: data.voteCounts,
            })
          }

          // Always update the vote counts to ensure real-time updates
          console.log("Updating vote counts from Pusher event")
          setVoteCounts(data.voteCounts)
          setTotalVotes(data.totalVotes)
          lastVoteUpdateId.current = `${data.questionId}-${data.timestamp || Date.now()}`
        }
      },
    )

    // Listen for custom answer updates
    gameChannel.bind(
      EVENTS.CUSTOM_ANSWER_ADDED,
      (data: {
        customAnswer: CustomAnswer
        questionId: string
      }) => {
        console.log("Custom answer received via Pusher:", data.customAnswer)

        // Only update if this is for the current question
        if (currentQuestionRef.current && data.questionId === currentQuestionRef.current) {
          // Check if we already have this custom answer
          const exists = customAnswers.some((ca) => ca.id === data.customAnswer.id)

          if (!exists) {
            setCustomAnswers((prev) => [...prev, data.customAnswer])

            // Update vote counts to include the new custom answer
            setVoteCounts((prev) => ({
              ...prev,
              [data.customAnswer.text]: 0,
            }))

            // Fetch updated vote counts
            fetchVoteCounts(data.questionId)
          }
        }
      },
    )

    // Listen for results announcement
    gameChannel.bind(EVENTS.SHOW_RESULTS, () => {
      console.log("Received SHOW_RESULTS event")
      router.push("/results")
    })

    // Listen for game reset
    gameChannel.bind(EVENTS.GAME_RESET, () => {
      console.log("Received GAME_RESET event")
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
      setHasAddedCustomAnswer(false) // Reset this state
      currentQuestionRef.current = null
      lastVoteUpdateId.current = null
    })

    return () => {
      console.log("Cleaning up Pusher event listeners")
      gameChannel.unbind(EVENTS.QUESTION_UPDATE)
      gameChannel.unbind(EVENTS.VOTE_UPDATE)
      gameChannel.unbind(EVENTS.CUSTOM_ANSWER_ADDED)
      gameChannel.unbind(EVENTS.SHOW_RESULTS)
      gameChannel.unbind(EVENTS.GAME_RESET)
    }
  }, [gameChannel, router, fetchCurrentQuestion, fetchVoteCounts, customAnswers])

  // Handle answer selection
  const handleAnswerChange = async (value: string) => {
    if (!currentQuestion || timeIsUp) return

    // If the user clicks on the same option they've already selected, do nothing
    if (value === selectedAnswer) return

    console.log("Answer changed from", selectedAnswer, "to", value)

    // Update local state immediately for responsive UI
    setSelectedAnswer(value)

    // Update vote counts optimistically
    setVoteCounts((prev) => {
      const newCounts = { ...prev }

      // If changing from a previously selected answer, decrement that count
      if (selectedAnswer && selectedAnswer !== value) {
        newCounts[selectedAnswer] = Math.max(0, (prev[selectedAnswer] || 0) - 1)
      }

      // Increment the count for the newly selected answer
      newCounts[value] = (prev[value] || 0) + 1

      return newCounts
    })

    // Update total votes if this is a new selection
    if (!selectedAnswer) {
      setTotalVotes((prev) => prev + 1)
    }

    // Submit the answer to the server
    if (!hasSubmitted) {
      setIsSubmittingAnswer(true)
      setHasSubmitted(true)
      setSubmittedAnswer(value)

      try {
        const result = await submitAnswer(currentQuestion.id, value)

        if (result.success) {
          console.log("Answer submitted successfully")
        } else {
          console.error("Error submitting answer:", result.error)
          // Don't revert UI state as the user has already seen their selection
        }
      } catch (error) {
        console.error("Error submitting answer:", error)
      } finally {
        setIsSubmittingAnswer(false)
      }
    } else if (submittedAnswer !== value) {
      // This is the case where the user is changing their answer after already submitting
      console.log("Changing previously submitted answer from", submittedAnswer, "to", value)
      setIsSubmittingAnswer(true)
      setSubmittedAnswer(value)

      try {
        const result = await submitAnswer(currentQuestion.id, value)

        if (result.success) {
          console.log("Answer changed successfully")
        } else {
          console.error("Error changing answer:", result.error)
        }
      } catch (error) {
        console.error("Error changing answer:", error)
      } finally {
        setIsSubmittingAnswer(false)
      }
    }
  }

  // Modify the handleAddCustomAnswer function to prevent page refresh and update the hasAddedCustomAnswer state
  const handleAddCustomAnswer = async () => {
    if (!newCustomAnswer.trim() || !currentQuestion || timeIsUp) return

    setIsSubmittingCustom(true)

    try {
      const result = await addCustomAnswer(currentQuestion.id, newCustomAnswer.trim())

      if (result.success && result.customAnswer) {
        setNewCustomAnswer("")

        // Add the custom answer to the local state immediately
        const newCustomAnswerObj = result.customAnswer
        setCustomAnswers((prev) => [...prev, newCustomAnswerObj])

        // Set the newly added answer as the selected answer
        setSelectedAnswer(newCustomAnswerObj.text)

        // Update vote counts optimistically
        setVoteCounts((prev) => ({
          ...prev,
          [newCustomAnswerObj.text]: 1,
        }))

        // Update total votes
        setTotalVotes((prev) => prev + 1)

        // Mark as submitted
        setSubmittedAnswer(newCustomAnswerObj.text)
        setHasSubmitted(true)

        // Set that the user has added a custom answer
        setHasAddedCustomAnswer(true)

        toast({
          title: "Custom answer added!",
          description: "Your answer has been submitted.",
        })
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

  // Handle timer expiration
  const handleTimeUp = () => {
    setTimeIsUp(true)

    // If the user has selected an answer but didn't submit it, auto-submit
    if (selectedAnswer && !hasSubmitted) {
      setHasSubmitted(true)
      setSubmittedAnswer(selectedAnswer)

      if (currentQuestion) {
        submitAnswer(currentQuestion.id, selectedAnswer).catch((error) => {
          console.error("Error auto-submitting answer:", error)
        })
      }
    }

    // Note: We're not disabling any Pusher listeners here,
    // so vote updates will continue to be received
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
        <PlayerHeartbeat />
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-arcane-navy p-4 pt-16 md:pt-4">
      <PlayerHeartbeat />

      {/* Player name display */}
      {playerName && (
        <div className="absolute top-4 left-4 text-arcane-gold font-medium md:static md:mb-4 md:self-start md:w-full">
          {playerName}
        </div>
      )}

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
            <form onSubmit={(e) => e.preventDefault()}>
              <RadioGroup
                value={selectedAnswer}
                onValueChange={handleAnswerChange}
                className="space-y-3"
                disabled={timeIsUp || isSubmittingAnswer}
              >
                {allOptions.map((option, index) => {
                  const voteCount = voteCounts[option] || 0
                  const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
                  const isCustom = customAnswers.some((ca) => ca.text === option)
                  const addedBy = isCustom ? customAnswers.find((ca) => ca.text === option)?.addedBy : null

                  return (
                    <div
                      key={index}
                      className={`relative flex items-center rounded-lg border p-3 transition-colors overflow-hidden ${
                        selectedAnswer === option
                          ? "border-arcane-blue bg-arcane-blue/10"
                          : "border-arcane-blue/20 bg-arcane-navy/50"
                      } ${timeIsUp ? "opacity-70" : ""} cursor-pointer`}
                      onClick={() => !timeIsUp && !isSubmittingAnswer && handleAnswerChange(option)}
                    >
                      {/* Background progress bar */}
                      <div className="absolute inset-0 bg-arcane-gold/10 z-0" style={{ width: `${percentage}%` }} />

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

                {currentQuestion.allowsCustomAnswers !== false && !timeIsUp && !hasAddedCustomAnswer && (
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            if (newCustomAnswer.trim() && !isSubmittingCustom && !timeIsUp) {
                              handleAddCustomAnswer()
                            }
                          }
                        }}
                      />
                      <Button
                        onClick={(e) => {
                          e.preventDefault()
                          handleAddCustomAnswer()
                        }}
                        disabled={!newCustomAnswer.trim() || isSubmittingCustom || timeIsUp}
                        className="bg-arcane-gold hover:bg-arcane-gold/80 text-arcane-navy h-8 w-8 p-0 rounded-full"
                        size="icon"
                        type="button"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </RadioGroup>
            </form>

            {totalVotes > 0 && (
              <div className="mt-2 text-xs text-arcane-gray flex items-center justify-end">
                <Users className="h-3 w-3 mr-1" />
                <span>Total votes: {totalVotes}</span>
              </div>
            )}
          </div>

          {/* Status message */}
          {selectedAnswer && hasSubmitted ? (
            <div className="w-full text-center py-2 text-green-400">
              Answer submitted! {isSubmittingAnswer && "Processing..."}
            </div>
          ) : timeIsUp ? (
            <div className="w-full text-center py-2 text-arcane-gray">Time's up! Waiting for the next question...</div>
          ) : !selectedAnswer ? (
            <div className="w-full text-center py-2 text-arcane-gray">Select an answer to submit</div>
          ) : (
            <div className="w-full text-center py-2"></div> // Empty div to maintain spacing
          )}
        </CardContent>
      </Card>
    </div>
  )
}
