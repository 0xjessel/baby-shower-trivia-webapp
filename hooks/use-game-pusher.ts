"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { usePusher } from "@/hooks/use-pusher"
import { EVENTS } from "@/lib/pusher-client"
import type { Question, CustomAnswer, VoteCounts } from "@/types/game"

interface GamePusherProps {
  currentQuestionRef: React.RefObject<string | null>
  lastVoteUpdateId: React.RefObject<string | null>
  submittedAnswer: string
  selectedAnswer: string
  hasAddedCustomAnswer: boolean
  customAnswers: CustomAnswer[]
  setCurrentQuestion: (question: Question | null) => void
  setSelectedAnswer: (answer: string) => void
  setSubmittedAnswer: (answer: string) => void
  setHasSubmitted: (hasSubmitted: boolean) => void
  setIsWaiting: (isWaiting: boolean) => void
  setTimerActive: (isActive: boolean) => void
  setTimeIsUp: (isTimeUp: boolean) => void
  setVoteCounts: (voteCounts: VoteCounts | ((prev: VoteCounts) => VoteCounts)) => void
  setTotalVotes: (totalVotes: number | ((prev: number) => number)) => void
  setCustomAnswers: (customAnswers: CustomAnswer[] | ((prev: CustomAnswer[]) => CustomAnswer[])) => void
  setHasAddedCustomAnswer: (hasAdded: boolean) => void
  fetchCurrentQuestion: () => Promise<void>
  fetchVoteCounts: (questionId: string) => Promise<void>
}

export function useGamePusher(props: GamePusherProps) {
  const {
    currentQuestionRef,
    lastVoteUpdateId,
    submittedAnswer,
    selectedAnswer,
    hasAddedCustomAnswer,
    customAnswers,
    setCurrentQuestion,
    setSelectedAnswer,
    setSubmittedAnswer,
    setHasSubmitted,
    setIsWaiting,
    setTimerActive,
    setTimeIsUp,
    setVoteCounts,
    setTotalVotes,
    setCustomAnswers,
    setHasAddedCustomAnswer,
    fetchCurrentQuestion,
    fetchVoteCounts,
  } = props

  const router = useRouter()
  const { gameChannel } = usePusher()

  // Use a ref to track if we've already set up the listeners
  const listenersSetupRef = useRef(false)

  // Set up Pusher event listeners
  useEffect(() => {
    if (!gameChannel || listenersSetupRef.current) return

    // Mark that we've set up the listeners
    listenersSetupRef.current = true

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
        console.log("[DEBUG] CUSTOM_ANSWER_ADDED event received:", data)
        console.log("[DEBUG] Current question ID:", currentQuestionRef.current)
        console.log("[DEBUG] Event question ID:", data.questionId)

        // Only update if this is for the current question
        if (currentQuestionRef.current && data.questionId === currentQuestionRef.current) {
          // More robust duplicate detection - check both ID and text
          const existsById = customAnswers.some((ca) => ca.id === data.customAnswer.id)
          const existsByText = customAnswers.some(
            (ca) => ca.text.toLowerCase().trim() === data.customAnswer.text.toLowerCase().trim(),
          )

          const exists = existsById || existsByText

          // Log the duplicate detection results
          if (exists) {
            console.log("[DEBUG] Duplicate custom answer detected:", existsById ? "by ID" : "by text content")

            // If it exists by text but not by ID, we might need to update the metadata
            if (!existsById && existsByText) {
              console.log("[DEBUG] Updating metadata for existing custom answer")
              setCustomAnswers((prev) =>
                prev.map((ca) =>
                  ca.text.toLowerCase().trim() === data.customAnswer.text.toLowerCase().trim()
                    ? { ...ca, addedBy: data.customAnswer.addedBy || ca.addedBy }
                    : ca,
                ),
              )
            }

            return
          }

          // This is a new custom answer from another participant
          if (!hasAddedCustomAnswer || data.customAnswer.addedBy !== localStorage.getItem("playerName")) {
            console.log("[DEBUG] Adding new custom answer from another participant")

            // Ensure the custom answer has the addedBy property
            const customAnswerWithAddedBy = {
              ...data.customAnswer,
              addedBy: data.customAnswer.addedBy || "Unknown",
            }

            // Add the new custom answer to the list
            setCustomAnswers((prev) => [...prev, customAnswerWithAddedBy])

            // Update vote counts to include the new custom answer
            setVoteCounts((prev) => ({
              ...prev,
              [data.customAnswer.text]: 0,
            }))

            // Fetch updated vote counts
            console.log("[DEBUG] Fetching updated vote counts")
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
      if (gameChannel) {
        gameChannel.unbind(EVENTS.QUESTION_UPDATE)
        gameChannel.unbind(EVENTS.VOTE_UPDATE)
        gameChannel.unbind(EVENTS.CUSTOM_ANSWER_ADDED)
        gameChannel.unbind(EVENTS.SHOW_RESULTS)
        gameChannel.unbind(EVENTS.GAME_RESET)
      }
      listenersSetupRef.current = false
    }
  }, [
    gameChannel,
    router,
    // Remove dependencies that change frequently
    // Keep only the stable references and functions
    currentQuestionRef,
    lastVoteUpdateId,
    setCurrentQuestion,
    setSelectedAnswer,
    setSubmittedAnswer,
    setHasSubmitted,
    setIsWaiting,
    setTimerActive,
    setTimeIsUp,
    setVoteCounts,
    setTotalVotes,
    setCustomAnswers,
    setHasAddedCustomAnswer,
    fetchCurrentQuestion,
    fetchVoteCounts,
  ])

  // Add a separate effect to handle updates to these values without re-initializing Pusher
  useEffect(() => {
    // This effect doesn't need to do anything, it's just here to handle
    // updates to these values without triggering the main Pusher setup effect
  }, [submittedAnswer, selectedAnswer, hasAddedCustomAnswer, customAnswers])

  return { gameChannel }
}
