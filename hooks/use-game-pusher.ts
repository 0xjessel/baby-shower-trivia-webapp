"use client"

import type React from "react"

import { useEffect } from "react"
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
          // Check if we already have this custom answer
          const exists = customAnswers.some((ca) => ca.id === data.customAnswer.id)

          // Also check if this is our own custom answer (by checking if we've already added a custom answer)
          // This prevents duplicate answers when receiving our own Pusher event
          if (!exists && !hasAddedCustomAnswer) {
            // Add the new custom answer to the list
            setCustomAnswers((prev) => [...prev, data.customAnswer])

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
      gameChannel.unbind(EVENTS.QUESTION_UPDATE)
      gameChannel.unbind(EVENTS.VOTE_UPDATE)
      gameChannel.unbind(EVENTS.CUSTOM_ANSWER_ADDED)
      gameChannel.unbind(EVENTS.SHOW_RESULTS)
      gameChannel.unbind(EVENTS.GAME_RESET)
    }
  }, [
    gameChannel,
    router,
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
  ])

  return { gameChannel }
}
