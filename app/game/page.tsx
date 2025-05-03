"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { submitAnswer, addCustomAnswer, updateVoteCount } from "@/app/actions"
import { usePusher } from "@/hooks/use-pusher"
import { EVENTS } from "@/lib/pusher-client"
import CountdownTimer from "@/components/countdown-timer"
import { toast } from "@/hooks/use-toast"
import { Users, Send } from "lucide-react"

// Add this export to disable static generation for this page
export const dynamic = "force-dynamic"

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
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const playerName = useRef<string>("")
  const router = useRouter()
  const { gameChannel, isLoading: isPusherLoading, isConnected } = usePusher()
  const previousAnswerRef = useRef<string | null>(null)
  const isUpdatingVoteRef = useRef(false)
  const lastVoteUpdateRef = useRef<string | null>(null)
  const lastCustomAnswersUpdateRef = useRef<string | null>(null)
  const pusherConnectionAttempts = useRef(0)

  // Fetch vote counts for the current question
  const fetchVoteCounts = useCallback(async (questionId: string) => {
    try {
      console.log("[DEBUG] Fetching vote counts for question:", questionId)
      const res = await fetch(`/api/vote-counts?questionId=${questionId}`)
      const data = await res.json()

      if (data.voteCounts) {
        console.log("[DEBUG] Vote counts received via API:", data.voteCounts, "Total:", data.totalVotes)

        // Generate a unique identifier for this update to avoid duplicates
        const updateId = JSON.stringify(data.voteCounts) + data.totalVotes + (data.timestamp || Date.now())

        // Only update if this is different from the last update we processed
        if (updateId !== lastVoteUpdateRef.current) {
          console.log("[DEBUG] Updating vote counts from API poll")
          setVoteCounts(data.voteCounts)
          setTotalVotes(data.totalVotes)
          lastVoteUpdateRef.current = updateId
        } else {
          console.log("[DEBUG] Skipping duplicate vote count update")
        }
      }
    } catch (err) {
      console.error("[DEBUG] Error fetching vote counts:", err)
    }
  }, [])

  // Fetch custom answers for the current question
  const fetchCustomAnswers = useCallback(
    async (questionId: string) => {
      try {
        console.log("[DEBUG] Fetching custom answers for question:", questionId)
        const res = await fetch(`/api/custom-answers?questionId=${questionId}`)
        const data = await res.json()

        if (data.customAnswers) {
          // Generate a unique identifier for this update to avoid duplicates
          const updateId = JSON.stringify(data.customAnswers)

          // Only update if there are changes
          if (updateId !== lastCustomAnswersUpdateRef.current) {
            console.log("[DEBUG] Custom answers received:", data.customAnswers.length)

            // Check if we have new custom answers
            const currentCustomAnswerIds = new Set(customAnswers.map((ca) => ca.id))
            const newCustomAnswers = data.customAnswers.filter((ca) => !currentCustomAnswerIds.has(ca.id))

            if (newCustomAnswers.length > 0) {
              console.log("[DEBUG] 🆕 New custom answers detected via polling:", newCustomAnswers.length)

              // Update custom answers
              setCustomAnswers(data.customAnswers)

              // Update vote counts to include new custom answers with 0 votes
              setVoteCounts((prev) => {
                const newCounts = { ...prev }
                newCustomAnswers.forEach((ca) => {
                  if (!newCounts[ca.text]) {
                    newCounts[ca.text] = 0
                  }
                })
                return newCounts
              })
            }

            lastCustomAnswersUpdateRef.current = updateId
          } else {
            console.log("[DEBUG] No new custom answers")
          }
        }
      } catch (err) {
        console.error("[DEBUG] Error fetching custom answers:", err)
      }
    },
    [customAnswers],
  )

  // Function to check if we're in a preview environment
  function isPreviewEnvironment() {
    if (typeof window === "undefined") return false

    const hostname = window.location.hostname

    // Only consider localhost as preview
    // Your production domain is babyjayceleaguechallenge.vercel.app
    return (
      hostname === "localhost" || (hostname.includes("vercel.app") && !hostname.startsWith("babyjayceleaguechallenge"))
    )
  }

  // Check if we're in preview mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      const inPreviewMode = isPreviewEnvironment()
      setIsPreviewMode(inPreviewMode)
      console.log(`[DEBUG] Running in ${inPreviewMode ? "PREVIEW" : "PRODUCTION"} mode`)
    }
  }, [])

  // Memoize the fetchCurrentQuestion function to avoid recreating it on every render
  const fetchCurrentQuestion = useCallback(async () => {
    try {
      console.log("[DEBUG] Fetching current question...")
      const res = await fetch("/api/current-question")
      const data = await res.json()

      if (data.waiting) {
        console.log("[DEBUG] Waiting for game to start")
        setIsWaiting(true)
        setCurrentQuestion(null)
        setTimerActive(false)
      } else if (data.question) {
        // Check if this is a new question or we don't have a question yet
        if (!currentQuestion || currentQuestion.id !== data.question.id) {
          console.log("[DEBUG] New question received:", data.question.id)
          setCurrentQuestion(data.question)
          setIsWaiting(false)
          setTimeIsUp(false)
          setTimerReset((prev) => prev + 1) // Reset timer
          setTimerActive(true) // Start timer

          // Initialize custom answers from API response
          if (data.customAnswers) {
            console.log("[DEBUG] Initial custom answers:", data.customAnswers.length)
            setCustomAnswers(data.customAnswers)
            lastCustomAnswersUpdateRef.current = JSON.stringify(data.customAnswers)
          } else {
            setCustomAnswers([])
            lastCustomAnswersUpdateRef.current = null
          }

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
            console.log("[DEBUG] User already answered:", data.selectedAnswer)
            setSelectedAnswer(data.selectedAnswer)
            setSubmittedAnswer(data.selectedAnswer)
            previousAnswerRef.current = data.selectedAnswer
            setHasSubmitted(true)
          } else {
            setSelectedAnswer("")
            setSubmittedAnswer("")
            previousAnswerRef.current = null
            setHasSubmitted(false)
          }

          // Fetch initial vote counts
          fetchVoteCounts(data.question.id)

          // Log that we've switched to new question via polling
          console.log("[DEBUG] 🔄 Switched to new question via polling")
        } else {
          // Same question, just check if the game state has changed (e.g., time's up)
          if (data.gameStatus === "results" && !timeIsUp) {
            console.log("[DEBUG] Game state changed to results via polling")
            setTimeIsUp(true)
          }

          // Check for new custom answers even if it's the same question
          if (data.customAnswers) {
            const updateId = JSON.stringify(data.customAnswers)
            if (updateId !== lastCustomAnswersUpdateRef.current) {
              console.log("[DEBUG] Updated custom answers from current-question API:", data.customAnswers.length)

              // Check for new custom answers
              const currentCustomAnswerIds = new Set(customAnswers.map((ca) => ca.id))
              const newCustomAnswers = data.customAnswers.filter((ca) => !currentCustomAnswerIds.has(ca.id))

              if (newCustomAnswers.length > 0) {
                console.log("[DEBUG] 🆕 New custom answers detected in current-question API:", newCustomAnswers.length)
                setCustomAnswers(data.customAnswers)

                // Update vote counts to include new custom answers
                setVoteCounts((prev) => {
                  const newCounts = { ...prev }
                  newCustomAnswers.forEach((ca) => {
                    if (!newCounts[ca.text]) {
                      newCounts[ca.text] = 0
                    }
                  })
                  return newCounts
                })
              }

              lastCustomAnswersUpdateRef.current = updateId
            }
          }
        }
      }
    } catch (err) {
      console.error("[DEBUG] Error fetching current question:", err)
    } finally {
      setIsLoading(false)
    }
  }, [currentQuestion, fetchVoteCounts, timeIsUp, customAnswers])

  useEffect(() => {
    // Ensure this code only runs in the browser
    if (typeof window === "undefined") return

    // Check if user is authenticated
    const name = localStorage.getItem("playerName")
    if (!name) {
      router.push("/join")
      return
    }

    playerName.current = name
    console.log(`[DEBUG] Player authenticated: ${name}`)

    // Fetch current question on initial load
    fetchCurrentQuestion()

    // Set up polling as a fallback for real-time updates
    const pollInterval = setInterval(() => {
      console.log("[DEBUG] Polling cycle started...")

      // Always check for question updates first to ensure we're on the latest question
      fetchCurrentQuestion().then(() => {
        // After ensuring we have the latest question, fetch vote counts and custom answers if needed
        if (currentQuestion) {
          console.log("[DEBUG] Also polling for vote updates and custom answers...")

          // Run these in parallel
          Promise.all([fetchVoteCounts(currentQuestion.id), fetchCustomAnswers(currentQuestion.id)]).catch((err) => {
            console.error("[DEBUG] Error in polling cycle:", err)
          })
        }
      })
    }, 3000) // Poll every 3 seconds

    return () => {
      console.log("[DEBUG] Clearing poll interval")
      clearInterval(pollInterval)
    }
  }, [router, fetchCurrentQuestion, currentQuestion, fetchVoteCounts, fetchCustomAnswers])

  useEffect(() => {
    // Ensure this code only runs in the browser
    if (typeof window === "undefined") return

    if (!gameChannel) {
      console.log("[DEBUG] No game channel available, relying on polling")
      return
    }

    console.log("[DEBUG] Setting up Pusher event listeners, connected:", isConnected)

    // Set up Pusher event listeners
    gameChannel.bind(EVENTS.QUESTION_UPDATE, (data: { question: Question }) => {
      console.log("[DEBUG] Received question update via Pusher:", data.question.id)
      setCurrentQuestion(data.question)
      setSelectedAnswer("")
      setSubmittedAnswer("")
      previousAnswerRef.current = null
      setHasSubmitted(false)
      setIsLoading(false)
      setIsWaiting(false)
      setTimeIsUp(false)
      setTimerReset((prev) => prev + 1) // Reset timer
      setTimerActive(true) // Start timer
      setCustomAnswers([]) // Reset custom answers for new question
      lastCustomAnswersUpdateRef.current = null // Reset custom answers tracking

      // Reset vote counts for new question
      const initialVoteCounts: VoteCounts = {}
      data.question.options.forEach((option) => {
        initialVoteCounts[option] = 0
      })
      setVoteCounts(initialVoteCounts)
      setTotalVotes(0)
      lastVoteUpdateRef.current = null // Reset vote tracking
    })

    // Listen for vote updates with improved logging and error handling
    gameChannel.bind(
      EVENTS.VOTE_UPDATE,
      (data: { voteCounts: VoteCounts; totalVotes: number; questionId: string; updatedAt?: string }) => {
        console.log("[DEBUG] 🔴 VOTE UPDATE RECEIVED via Pusher:", data)
        console.log("[DEBUG] Current question ID:", currentQuestion?.id)
        console.log("[DEBUG] Update question ID:", data.questionId)
        console.log("[DEBUG] Vote counts:", data.voteCounts)
        console.log("[DEBUG] Total votes:", data.totalVotes)
        console.log("[DEBUG] Updated at:", data.updatedAt || "unknown")

        // Only update if this update is for the current question
        if (currentQuestion && data.questionId === currentQuestion.id) {
          // Generate a unique identifier for this update to avoid duplicates
          const updateId = JSON.stringify(data.voteCounts) + data.totalVotes + (data.updatedAt || Date.now())

          // Only update if this is different from the last update we processed
          if (updateId !== lastVoteUpdateRef.current) {
            console.log("[DEBUG] 🟢 Updating vote counts from Pusher event")
            setVoteCounts(data.voteCounts)
            setTotalVotes(data.totalVotes)
            lastVoteUpdateRef.current = updateId
          } else {
            console.log("[DEBUG] Skipping duplicate Pusher vote update")
          }
        } else {
          console.log("[DEBUG] Ignoring vote update for different question")
        }
      },
    )

    // Listen for custom answer updates
    gameChannel.bind(EVENTS.CUSTOM_ANSWER_ADDED, (data: { customAnswer: CustomAnswer }) => {
      console.log("[DEBUG] 🆕 Received custom answer via Pusher:", data.customAnswer)

      // Check if we already have this custom answer
      const exists = customAnswers.some((ca) => ca.id === data.customAnswer.id)

      if (!exists) {
        // Add the new custom answer
        setCustomAnswers((prev) => [...prev, data.customAnswer])

        // Update vote counts to include the new custom answer
        setVoteCounts((prev) => ({
          ...prev,
          [data.customAnswer.text]: 0,
        }))
      } else {
        console.log("[DEBUG] Custom answer already exists, skipping")
      }
    })

    // Listen for results announcement
    gameChannel.bind(EVENTS.SHOW_RESULTS, () => {
      console.log("[DEBUG] Received SHOW_RESULTS event, redirecting to results page")
      router.push("/results")
    })

    // Listen for game reset
    gameChannel.bind(EVENTS.GAME_RESET, () => {
      console.log("[DEBUG] Received GAME_RESET event")
      setCurrentQuestion(null)
      setSelectedAnswer("")
      setSubmittedAnswer("")
      previousAnswerRef.current = null
      setHasSubmitted(false)
      setIsWaiting(true)
      setTimerActive(false)
      setTimeIsUp(false)
      setVoteCounts({})
      setTotalVotes(0)
      setCustomAnswers([])
      lastCustomAnswersUpdateRef.current = null
      lastVoteUpdateRef.current = null
    })

    return () => {
      console.log("[DEBUG] Cleaning up Pusher event listeners")
      // Clean up event listeners
      gameChannel.unbind(EVENTS.QUESTION_UPDATE)
      gameChannel.unbind(EVENTS.VOTE_UPDATE)
      gameChannel.unbind(EVENTS.CUSTOM_ANSWER_ADDED)
      gameChannel.unbind(EVENTS.SHOW_RESULTS)
      gameChannel.unbind(EVENTS.GAME_RESET)
    }
  }, [gameChannel, router, currentQuestion, isConnected, customAnswers])

  const handleAnswerChange = async (value: string) => {
    if (!currentQuestion) return

    const previousAnswer = previousAnswerRef.current

    console.log("[DEBUG] Answer changed:", {
      from: previousAnswer || "none",
      to: value,
      questionId: currentQuestion.id,
    })

    // Optimistically update the UI
    setSelectedAnswer(value)

    // Update vote counts optimistically
    setVoteCounts((prev) => {
      const newCounts = { ...prev }

      // If changing from a previously selected answer, decrement that count
      if (previousAnswer && previousAnswer !== value) {
        newCounts[previousAnswer] = Math.max(0, (prev[previousAnswer] || 0) - 1)
      }

      // Increment the count for the newly selected answer
      newCounts[value] = (prev[value] || 0) + 1

      console.log("[DEBUG] Updated vote counts (optimistic):", newCounts)
      return newCounts
    })

    // Update total votes if this is a new selection
    if (!previousAnswer) {
      setTotalVotes((prev) => prev + 1)
    }

    // Store the new answer as the previous answer for next time
    previousAnswerRef.current = value

    // If already submitted and user selects a different answer, allow resubmission
    if (hasSubmitted && !timeIsUp && value !== submittedAnswer) {
      setHasSubmitted(false)
    }

    // Prevent multiple simultaneous vote updates
    if (isUpdatingVoteRef.current) {
      console.log("[DEBUG] Vote update already in progress, skipping")
      return
    }

    isUpdatingVoteRef.current = true

    try {
      console.log("[DEBUG] Sending vote update to server")
      // Send the update to the server
      const result = await updateVoteCount(currentQuestion.id, value, previousAnswer)

      if (!result.success) {
        console.error("[DEBUG] Server reported error updating vote count:", result.error)
      } else {
        console.log("[DEBUG] Server confirmed vote update success")
      }
    } catch (error) {
      console.error("[DEBUG] Failed to update vote count:", error)
      // If the server update fails, we could revert the optimistic update here
      // but for simplicity, we'll leave it as is since the next poll will sync
    } finally {
      isUpdatingVoteRef.current = false
    }
  }

  const handleSubmit = async () => {
    if (!selectedAnswer || !currentQuestion) return

    try {
      console.log("[DEBUG] Submitting answer:", selectedAnswer)
      // Optimistically update UI
      setSubmittedAnswer(selectedAnswer)
      setHasSubmitted(true)

      // Send to server
      const result = await submitAnswer(currentQuestion.id, selectedAnswer)

      if (result.success) {
        console.log("[DEBUG] Answer submitted successfully")
        toast({
          title: "Answer submitted!",
        })
      } else {
        console.error("[DEBUG] Server reported error submitting answer:", result.error)
        throw new Error(result.error || "Failed to submit answer")
      }
    } catch (error) {
      console.error("[DEBUG] Failed to submit answer:", error)

      // Revert optimistic update on error
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
        previousAnswerRef.current = newCustomAnswerObj.text

        // Update vote counts optimistically
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
            {isPreviewMode && (
              <p className="mt-4 text-xs text-arcane-gold">Running in preview mode (polling for updates)</p>
            )}
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
                    className={`relative flex items-center rounded-lg border p-3 transition-colors overflow-hidden ${
                      selectedAnswer === option
                        ? "border-arcane-blue bg-arcane-blue/10"
                        : "border-arcane-blue/20 bg-arcane-navy/50"
                    } ${timeIsUp ? "opacity-70" : ""} cursor-pointer`}
                    onClick={() => !timeIsUp && handleAnswerChange(option)}
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

          {isPreviewMode && (
            <p className="mt-4 text-xs text-center text-arcane-gold">Running in preview mode (polling for updates)</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
