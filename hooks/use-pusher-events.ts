"use client"

import type React from "react"

import { useEffect, useRef, useCallback } from "react"
import { usePusher } from "@/hooks/use-pusher"
import { isDuplicateCustomAnswer } from "@/lib/game-utils"

// Map to track processed events by ID to prevent duplicates
const processedEvents = new Map<string, boolean>()

export function usePusherEvents(
  currentQuestionRef: React.MutableRefObject<any>,
  customAnswers: any[],
  setCustomAnswers: (answers: any[]) => void,
  setVoteCounts: (counts: any) => void,
  setTotalVotes: (total: number) => void,
  fetchCurrentQuestion: () => Promise<any>,
  fetchVoteCounts: (questionId: string, updateId: string) => Promise<any>,
  setIsLoadingQuestion: (isLoading: boolean) => void,
  resetCustomAnswerState?: () => void,
) {
  const { gameChannel, pusher } = usePusher()

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
      // Check if we've already processed this exact event
      const eventId = `custom-answer-${data.customAnswer.id}-${data.timestamp}`
      if (processedEvents.has(eventId)) {
        return
      }

      // Check if this is a stale event (older than the last one we processed)
      if (data.timestamp && data.timestamp <= lastEventTimestampRef.current["custom-answer-added"]) {
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
          setCustomAnswers([...customAnswers, data.customAnswer])

          // Update vote counts if provided
          if (data.voteCounts) {
            setVoteCounts(data.voteCounts)
            setTotalVotes(data.totalVotes || 0)
          } else {
            // Fetch updated vote counts if not provided in the event
            fetchVoteCounts(data.questionId, data.updateId)
          }
        }
      }
    },
    [customAnswers, setCustomAnswers, setVoteCounts, setTotalVotes, fetchVoteCounts, currentQuestionRef],
  )

  // Handle vote counts updated event
  const handleVoteCountsUpdated = useCallback(
    (data: any) => {
      // Check if this is a stale event (older than the last one we processed)
      if (data.timestamp && data.timestamp <= lastEventTimestampRef.current["vote-update"]) {
        return
      }

      // Update the last timestamp
      if (data.timestamp) {
        lastEventTimestampRef.current["vote-update"] = data.timestamp
      }

      if (currentQuestionRef.current === data.questionId) {
        fetchVoteCounts(data.questionId, data.updateId)
      }
    },
    [fetchVoteCounts, currentQuestionRef],
  )

  // Handle question updated event
  const handleQuestionUpdated = useCallback(
    (data: any) => {
      // Check if this is a stale event (older than the last one we processed)
      if (data.timestamp && data.timestamp <= lastEventTimestampRef.current["question-update"]) {
        return
      }

      // Update the last timestamp
      if (data.timestamp) {
        lastEventTimestampRef.current["question-update"] = data.timestamp
      }

      setIsLoadingQuestion(false)
      fetchCurrentQuestion()
    },
    [fetchCurrentQuestion, setIsLoadingQuestion],
  )

  // Handle loading question event
  const handleLoadingQuestion = useCallback(
    (data: any) => {
      // Check if this is a stale event (older than the last one we processed)
      if (data.timestamp && data.timestamp <= lastEventTimestampRef.current["loading-question"]) {
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
    window.location.href = "/results"
  }, [])

  // Set up Pusher event listeners
  useEffect(() => {
    // Only set up event listeners if we have a game channel and haven't set them up yet
    if (!gameChannel || eventsSetupRef.current) return

    eventsSetupRef.current = true

    // Handle custom answer added event
    gameChannel.bind("custom-answer-added", handleCustomAnswerAdded)

    // Handle vote counts updated event
    gameChannel.bind("vote-update", handleVoteCountsUpdated)

    // Handle question updated event
    gameChannel.bind("question-update", handleQuestionUpdated)

    // Handle loading question event
    gameChannel.bind("loading-question", handleLoadingQuestion)

    // Handle show results event
    gameChannel.bind("show-results", handleShowResults)

    return () => {
      if (gameChannel) {
        gameChannel.unbind("custom-answer-added", handleCustomAnswerAdded)
        gameChannel.unbind("vote-update", handleVoteCountsUpdated)
        gameChannel.unbind("question-update", handleQuestionUpdated)
        gameChannel.unbind("loading-question", handleLoadingQuestion)
        gameChannel.unbind("show-results", handleShowResults)
      }
      eventsSetupRef.current = false
    }
  }, [
    gameChannel,
    handleCustomAnswerAdded,
    handleVoteCountsUpdated,
    handleQuestionUpdated,
    handleLoadingQuestion,
    handleShowResults,
  ])

  // Update the new-question event handler to reset custom answer state
  useEffect(() => {
    if (!pusher) return

    const channel = pusher.subscribe("game-channel")

    channel.bind("new-question", async () => {
      setIsLoadingQuestion(true)

      // Reset custom answer state if the function is provided
      if (resetCustomAnswerState) {
        resetCustomAnswerState()
      }

      try {
        await fetchCurrentQuestion()
      } catch (error) {
        console.error("Error fetching new question:", error)
      } finally {
        setIsLoadingQuestion(false)
      }
    })

    return () => {
      if (channel) {
        channel.unbind("new-question")
      }
    }
  }, [pusher, fetchCurrentQuestion, setIsLoadingQuestion, resetCustomAnswerState])
}
