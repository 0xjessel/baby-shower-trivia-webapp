"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import type { Question, CustomAnswer, VoteCounts } from "@/types/game"
import { submitAnswer, addCustomAnswer } from "@/app/actions"
import { usePusher } from "@/hooks/use-pusher"

export function useGameState() {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string>("")
  const [submittedAnswer, setSubmittedAnswer] = useState<string>("")
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isWaiting, setIsWaiting] = useState(true)
  const [timerActive, setTimerActive] = useState(false)
  const [timerReset, setTimerReset] = useState(0)
  const [timeIsUp, setTimeIsUp] = useState(false)
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({})
  const [totalVotes, setTotalVotes] = useState(0)
  const [playerName, setPlayerName] = useState<string>("")
  const [customAnswers, setCustomAnswers] = useState<CustomAnswer[]>([])
  const [newCustomAnswer, setNewCustomAnswer] = useState("")
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false)
  const [hasAddedCustomAnswer, setHasAddedCustomAnswer] = useState(false)

  const playerNameRef = useRef<string>("")
  const router = useRouter()
  const { gameChannel } = usePusher()

  // Track the last vote update we received to avoid duplicates
  const lastVoteUpdateId = useRef<string | null>(null)

  // Track the current question ID for cleanup
  const currentQuestionRef = useRef<string | null>(null)

  // Fetch current question - use useCallback to ensure the function reference is stable
  const fetchCurrentQuestion = useCallback(async () => {
    try {
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
      console.log("Current question API response:", data)

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
          // Still store custom answers in the background for vote counting
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
            fetchVoteCounts(data.question.id)
          }
        }
      }
    } catch (err) {
      console.error("Error fetching current question:", err)
    }
  }, []) // Empty dependency array to ensure stable reference

  // Use a ref to store the current state values that the callback needs
  const stateRef = useRef({
    currentQuestion,
    customAnswers,
    timeIsUp,
  })

  // Update the ref whenever these values change
  useEffect(() => {
    stateRef.current = {
      currentQuestion,
      customAnswers,
      timeIsUp,
    }
  }, [currentQuestion, customAnswers, timeIsUp])

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
  }, []) // Empty dependency array to ensure stable reference

  // Handle answer selection
  const handleAnswerChange = useCallback(
    async (value: string) => {
      const { currentQuestion, timeIsUp } = stateRef.current

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
    },
    [selectedAnswer, submittedAnswer, hasSubmitted],
  )

  // Handle timer expiration
  const handleTimeUp = useCallback(() => {
    const { currentQuestion } = stateRef.current

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
  }, [selectedAnswer, hasSubmitted])

  // Handle custom answer submission
  const handleAddCustomAnswer = useCallback(
    async (e?: React.FormEvent) => {
      const { currentQuestion, timeIsUp } = stateRef.current

      // If an event was passed, prevent default behavior
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }

      if (!newCustomAnswer.trim() || !currentQuestion || timeIsUp) return

      console.log("[DEBUG] handleAddCustomAnswer - Starting custom answer submission")
      console.log("[DEBUG] Current question:", currentQuestion.id)
      console.log("[DEBUG] New custom answer:", newCustomAnswer.trim())

      // Check for duplicates before submitting
      const normalizedInput = newCustomAnswer.trim().toLowerCase()
      const isDuplicate = customAnswers.some((ca) => ca.text.toLowerCase().trim() === normalizedInput)

      if (isDuplicate) {
        console.log("[DEBUG] Prevented submitting duplicate custom answer")
        toast({
          title: "Duplicate answer",
          description: "This answer has already been added.",
          variant: "destructive",
        })
        return false
      }

      setIsSubmittingCustom(true)

      // Set this flag early to prevent duplicate processing
      setHasAddedCustomAnswer(true)

      try {
        console.log("[DEBUG] Calling addCustomAnswer server action")
        const result = await addCustomAnswer(currentQuestion.id, newCustomAnswer.trim())
        console.log("[DEBUG] Server action result:", result)

        if (result.success && result.customAnswer) {
          console.log("[DEBUG] Custom answer added successfully:", result.customAnswer)
          setNewCustomAnswer("")

          // Add the custom answer to the local state immediately
          const newCustomAnswerObj = result.customAnswer

          // Ensure the addedBy field is set
          if (!newCustomAnswerObj.addedBy && playerNameRef.current) {
            newCustomAnswerObj.addedBy = playerNameRef.current
          }

          // Check for duplicates before adding locally
          const isDuplicateLocal = customAnswers.some(
            (ca) =>
              ca.id === newCustomAnswerObj.id ||
              ca.text.toLowerCase().trim() === newCustomAnswerObj.text.toLowerCase().trim(),
          )

          if (!isDuplicateLocal) {
            setCustomAnswers((prev) => [...prev, newCustomAnswerObj])
          } else {
            console.log("[DEBUG] Prevented adding duplicate custom answer locally")
          }

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

          // Set this flag to true to indicate the user has added a custom answer
          setHasAddedCustomAnswer(true)

          toast({
            title: "Custom answer added!",
            description: "Your answer has been submitted.",
          })
        } else {
          console.log("[DEBUG] Failed to add custom answer:", result.error)
          // Reset the flag if the submission failed
          setHasAddedCustomAnswer(false)
          toast({
            title: "Error",
            description: result.error || "Failed to add custom answer.",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("[DEBUG] Exception in handleAddCustomAnswer:", error)
        // Reset the flag if there was an error
        setHasAddedCustomAnswer(false)
        toast({
          title: "Error",
          description: "Failed to add custom answer. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsSubmittingCustom(false)
        console.log("[DEBUG] handleAddCustomAnswer completed")
      }

      return false
    },
    [newCustomAnswer, customAnswers, toast],
  )

  // Handle key press in custom answer input
  const handleCustomAnswerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      console.log("[DEBUG] Key pressed in custom answer input:", e.key)
      if (e.key === "Enter") {
        console.log("[DEBUG] Enter key pressed, preventing default")
        e.preventDefault()
        if (newCustomAnswer.trim() && !isSubmittingCustom && !stateRef.current.timeIsUp) {
          console.log("[DEBUG] Calling handleAddCustomAnswer from Enter key press")
          handleAddCustomAnswer()
        }
      }
    },
    [newCustomAnswer, isSubmittingCustom, handleAddCustomAnswer],
  )

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
    setPlayerName(name)

    // Fetch current question on initial load
    fetchCurrentQuestion()

    // Set up Pusher event listeners
    if (gameChannel) {
      // Handle custom answer added event
      gameChannel.bind("custom-answer-added", (data: any) => {
        console.log("[DEBUG] CUSTOM_ANSWER_ADDED event received:", data)

        // Check if this event is for the current question
        if (currentQuestionRef.current === data.questionId) {
          console.log("[DEBUG] Current question ID:", currentQuestionRef.current)
          console.log("[DEBUG] Event question ID:", data.questionId)

          // Only add the custom answer if it wasn't added by the current user
          // Check both the ID and the text to prevent duplicates
          const isDuplicate = customAnswers.some(
            (ca) =>
              ca.id === data.customAnswer.id ||
              ca.text.toLowerCase().trim() === data.customAnswer.text.toLowerCase().trim(),
          )

          if (!isDuplicate) {
            console.log("[DEBUG] Adding new custom answer from another participant")
            setCustomAnswers((prev) => [...prev, data.customAnswer])

            // Update vote counts if provided
            if (data.voteCounts) {
              setVoteCounts(data.voteCounts)
              setTotalVotes(data.totalVotes || 0)
            } else {
              // Fetch updated vote counts if not provided in the event
              console.log("[DEBUG] Fetching updated vote counts")
              fetchVoteCounts(data.questionId)
            }
          } else {
            console.log("[DEBUG] Ignoring duplicate custom answer:", data.customAnswer.text)
          }
        }
      })

      // Handle vote counts updated event
      gameChannel.bind("vote-counts-updated", (data: any) => {
        console.log("[DEBUG] VOTE_COUNTS_UPDATED event received:", data)
        if (currentQuestionRef.current === data.questionId) {
          fetchVoteCounts(data.questionId)
        }
      })

      // Handle question updated event
      gameChannel.bind("question-updated", (data: any) => {
        console.log("[DEBUG] QUESTION_UPDATED event received:", data)
        fetchCurrentQuestion()
      })

      return () => {
        // Clean up event listeners
        if (gameChannel) {
          gameChannel.unbind("custom-answer-added")
          gameChannel.unbind("vote-counts-updated")
          gameChannel.unbind("question-updated")
        }
      }
    }
  }, [router, fetchCurrentQuestion, gameChannel, fetchVoteCounts, customAnswers])

  return {
    // State
    currentQuestion,
    selectedAnswer,
    submittedAnswer,
    hasSubmitted,
    isWaiting,
    timerActive,
    timerReset,
    timeIsUp,
    voteCounts,
    totalVotes,
    playerName,
    customAnswers,
    newCustomAnswer,
    isSubmittingAnswer,
    isSubmittingCustom,
    hasAddedCustomAnswer,

    // Refs
    currentQuestionRef,
    lastVoteUpdateId,

    // Methods
    setCurrentQuestion,
    setSelectedAnswer,
    setSubmittedAnswer,
    setHasSubmitted,
    setIsWaiting,
    setTimerActive,
    setTimerReset,
    setTimeIsUp,
    setVoteCounts,
    setTotalVotes,
    setCustomAnswers,
    setNewCustomAnswer,
    setIsSubmittingCustom,
    setHasAddedCustomAnswer,
    fetchCurrentQuestion,
    fetchVoteCounts,
    handleAnswerChange,
    handleTimeUp,
    handleAddCustomAnswer,
    handleCustomAnswerKeyDown,
  }
}
