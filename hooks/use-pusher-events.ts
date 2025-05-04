"use client"

import type React from "react"

import { useEffect, useRef, useCallback } from "react"
import { usePusher } from "@/hooks/use-pusher"
import { EVENTS } from "@/lib/constants"
import { isDuplicateCustomAnswer } from "@/lib/game-utils"
import type { CustomAnswer } from "@/types/game"

// Map to track processed events by ID to prevent duplicates
const processedEvents = new Map<string, boolean>()

export function usePusherEvents(
  currentQuestionRef: React.MutableRefObject<any>,
  customAnswers: CustomAnswer[],
  setCustomAnswers: (answers: CustomAnswer[] | ((prev: CustomAnswer[]) => CustomAnswer[])) => void,
  setVoteCounts: (counts: any) => void,
  setTotalVotes: (total: number) => void,
  fetchCurrentQuestion: () => Promise<any>,
  fetchVoteCounts: (questionId: string, updateId?: string) => Promise<any>,
  setIsLoadingQuestion: (isLoading: boolean) => void,
  resetCustomAnswerState?: () => void,
) {
  const { gameChannel } = usePusher()

  // Track if we've already set up event listeners
  const eventsSetupRef = useRef(false)

  // Track the last event timestamp to prevent duplicates
  const lastEventTimestampRef = useRef<Record<string, number>>({
    "custom-answer-added": 0,
    "vote-update": 0,
    "question-update": 0,
    "loading-question": 0,
  })

  // Handle custom answer added event
  const handleCustomAnswerAdded = useCallback(
    (data: any) => {
      console.log("[PUSHER] Received custom-answer-added event:", data)

      // Check if we've already processed this exact event
      const eventId = `custom-answer-${data.customAnswer?.id || "unknown"}-${data.timestamp || Date.now()}`
      if (processedEvents.has(eventId)) {
        console.log("[PUSHER] Skipping already processed event:", eventId)
        return
      }

      // Check if this is a stale event (older than the last one we processed)
      if (data.timestamp && data.timestamp <= lastEventTimestampRef.current["custom-answer-added"]) {
        console.log("[PUSHER] Skipping stale event:", data.timestamp)
        return
      }

      // Update the last timestamp
      if (data.timestamp) {
        lastEventTimestampRef.current["custom-answer-added"] = data.timestamp
      }

      // Mark this event as processed
      processedEvents.set(eventId, true)

      // Check if this event is for the current question
      if (currentQuestionRef.current === data.questionId) {
        // Only add the custom answer if it's not a duplicate
        if (!isDuplicateCustomAnswer(data.customAnswer, customAnswers)) {
          console.log("[PUSHER] Adding new custom answer:", data.customAnswer)
          setCustomAnswers((prev) => [...prev, data.customAnswer])

          // Update vote counts if provided
          if (data.voteCounts) {
            setVoteCounts(data.voteCounts)
            setTotalVotes(data.totalVotes || 0)
          } else {
            // Fetch updated vote counts if not provided in the event
            fetchVoteCounts(data.questionId, data.updateId)
          }
        } else {
          console.log("[PUSHER] Ignoring duplicate custom answer:", data.customAnswer)
        }
      } else {
        console.log("[PUSHER] Ignoring custom answer for different question")
      }
    },
    [customAnswers, setCustomAnswers, setVoteCounts, setTotalVotes, fetchVoteCounts, currentQuestionRef],
  )

  // Handle vote counts updated event
  const handleVoteCountsUpdated = useCallback(
    (data: any) => {
      console.log("[PUSHER] Received vote-update event:", data)

      // Check if this is a stale event (older than the last one we processed)
      if (data.timestamp && data.timestamp <= lastEventTimestampRef.current["vote-update"]) {
        console.log("[PUSHER] Skipping stale vote update event:", data.timestamp)
        return
      }

      // Update the last timestamp
      if (data.timestamp) {
        lastEventTimestampRef.current["vote-update"] = data.timestamp
      }

      if (currentQuestionRef.current === data.questionId) {
        console.log("[PUSHER] Fetching updated vote counts for current question")
        fetchVoteCounts(data.questionId, data.updateId)
      } else {
        console.log("[PUSHER] Ignoring vote update for different question")
      }
    },
    [fetchVoteCounts, currentQuestionRef],
  )

  // Handle question updated event
  const handleQuestionUpdated = useCallback(
    (data: any) => {
      console.log("[PUSHER] Received question-update event:", data)

      // Check if this is a stale event (older than the last one we processed)
      if (data.timestamp && data.timestamp <= lastEventTimestampRef.current["question-update"]) {
        console.log("[PUSHER] Skipping stale question update event:", data.timestamp)
        return
      }

      // Update the last timestamp
      if (data.timestamp) {
        lastEventTimestampRef.current["question-update"] = data.timestamp
      }

      // Reset custom answer state when a new question is received
      if (resetCustomAnswerState) {
        console.log("[PUSHER] Resetting custom answer state")
        resetCustomAnswerState()
      }

      setIsLoadingQuestion(false)
      console.log("[PUSHER] Fetching current question")
      fetchCurrentQuestion()
    },
    [fetchCurrentQuestion, setIsLoadingQuestion, resetCustomAnswerState],
  )

  // Handle new question event (alias for question-update)
  const handleNewQuestion = useCallback(
    (data: any) => {
      console.log("[PUSHER] Received new-question event:", data)

      // Reset custom answer state when a new question is received
      if (resetCustomAnswerState) {
        console.log("[PUSHER] Resetting custom answer state")
        resetCustomAnswerState()
      }

      setIsLoadingQuestion(true)
      console.log("[PUSHER] Fetching current question")
      fetchCurrentQuestion().finally(() => {
        setIsLoadingQuestion(false)
      })
    },
    [fetchCurrentQuestion, setIsLoadingQuestion, resetCustomAnswerState],
  )

  // Handle loading question event
  const handleLoadingQuestion = useCallback(
    (data: any) => {
      console.log("[PUSHER] Received loading-question event:", data)

      // Check if this is a stale event (older than the last one we processed)
      if (data.timestamp && data.timestamp <= lastEventTimestampRef.current["loading-question"]) {
        console.log("[PUSHER] Skipping stale loading question event:", data.timestamp)
        return
      }

      // Update the last timestamp
      if (data.timestamp) {
        lastEventTimestampRef.current["loading-question"] = data.timestamp
      }

      setIsLoadingQuestion(true)
    },
    [setIsLoadingQuestion],
  )

  // Add a handler for the show-results event
  const handleShowResults = useCallback(() => {
    console.log("[PUSHER] Received show-results event")
    window.location.href = "/results"
  }, [])

  // Set up Pusher event listeners
  useEffect(() => {
    // Only set up event listeners if we have a game channel and haven't set them up yet
    if (!gameChannel || eventsSetupRef.current) {
      console.log("[PUSHER] Skipping event setup - channel not ready or already set up")
      return
    }

    console.log("[PUSHER] Setting up event listeners on game channel")
    eventsSetupRef.current = true

    // Handle custom answer added event
    gameChannel.bind(EVENTS.CUSTOM_ANSWER_ADDED, handleCustomAnswerAdded)
    console.log(`[PUSHER] Bound to ${EVENTS.CUSTOM_ANSWER_ADDED} event`)

    // Handle vote counts updated event
    gameChannel.bind(EVENTS.VOTE_COUNTS_UPDATED, handleVoteCountsUpdated)
    console.log(`[PUSHER] Bound to ${EVENTS.VOTE_COUNTS_UPDATED} event`)

    // Handle question updated event - bind to both event names to ensure compatibility
    gameChannel.bind("question-update", handleQuestionUpdated)
    console.log(`[PUSHER] Bound to question-update event`)

    // Also bind to new-question event
    gameChannel.bind(EVENTS.NEW_QUESTION, handleNewQuestion)
    console.log(`[PUSHER] Bound to ${EVENTS.NEW_QUESTION} event`)

    // Handle loading question event
    gameChannel.bind("loading-question", handleLoadingQuestion)
    console.log(`[PUSHER] Bound to loading-question event`)

    // Handle show results event
    gameChannel.bind(EVENTS.SHOW_RESULTS, handleShowResults)
    console.log(`[PUSHER] Bound to ${EVENTS.SHOW_RESULTS} event`)

    return () => {
      console.log("[PUSHER] Cleaning up event listeners")
      if (gameChannel) {
        gameChannel.unbind(EVENTS.CUSTOM_ANSWER_ADDED, handleCustomAnswerAdded)
        gameChannel.unbind(EVENTS.VOTE_COUNTS_UPDATED, handleVoteCountsUpdated)
        gameChannel.unbind("question-update", handleQuestionUpdated)
        gameChannel.unbind(EVENTS.NEW_QUESTION, handleNewQuestion)
        gameChannel.unbind("loading-question", handleLoadingQuestion)
        gameChannel.unbind(EVENTS.SHOW_RESULTS, handleShowResults)
      }
      eventsSetupRef.current = false
    }
  }, [
    gameChannel,
    handleCustomAnswerAdded,
    handleVoteCountsUpdated,
    handleQuestionUpdated,
    handleNewQuestion,
    handleLoadingQuestion,
    handleShowResults,
  ])

  return { gameChannel }
}
