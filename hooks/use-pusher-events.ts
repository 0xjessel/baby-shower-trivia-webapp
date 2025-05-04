"use client"

import type React from "react"

import { useEffect, useRef, useCallback } from "react"
import { usePusher } from "@/hooks/use-pusher"
import type { CustomAnswer } from "@/types/game"
import { isDuplicateCustomAnswer } from "@/lib/game-utils"

// Map to track processed events by ID to prevent duplicates
const processedEvents = new Map<string, boolean>()

export function usePusherEvents(
  currentQuestionRef: React.RefObject<string | null>,
  customAnswers: CustomAnswer[],
  setCustomAnswers: (answers: CustomAnswer[]) => void,
  setVoteCounts: (counts: any) => void,
  setTotalVotes: (total: number) => void,
  fetchCurrentQuestion: () => Promise<any>,
  fetchVoteCounts: (questionId: string) => Promise<void>,
  setIsLoadingQuestion: (loading: boolean) => void,
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
      // Check if we've already processed this exact event
      const eventId = `custom-answer-${data.customAnswer.id}-${data.timestamp}`
      if (processedEvents.has(eventId)) {
        console.log("[DEBUG] Skipping already processed custom answer event:", eventId)
        return
      }

      // Check if this is a stale event (older than the last one we processed)
      if (data.timestamp && data.timestamp <= lastEventTimestampRef.current["custom-answer-added"]) {
        console.log("[DEBUG] Skipping stale custom answer event:", data.timestamp)
        return
      }

      // Update the last timestamp
      if (data.timestamp) {
        lastEventTimestampRef.current["custom-answer-added"] = data.timestamp
      }

      // Mark this event as processed
      processedEvents.set(eventId, true)

      console.log("[DEBUG] CUSTOM_ANSWER_ADDED event received:", data)

      // Check if this event is for the current question
      if (currentQuestionRef.current === data.questionId) {
        console.log("[DEBUG] Current question ID:", currentQuestionRef.current)
        console.log("[DEBUG] Event question ID:", data.questionId)

        // Only add the custom answer if it's not a duplicate
        if (!isDuplicateCustomAnswer(data.customAnswer, customAnswers)) {
          console.log("[DEBUG] Adding new custom answer from another participant")
          setCustomAnswers([...customAnswers, data.customAnswer])

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
    },
    [customAnswers, setCustomAnswers, setVoteCounts, setTotalVotes, fetchVoteCounts, currentQuestionRef],
  )

  // Handle vote counts updated event
  const handleVoteCountsUpdated = useCallback(
    (data: any) => {
      // Check if this is a stale event (older than the last one we processed)
      if (data.timestamp && data.timestamp <= lastEventTimestampRef.current["vote-update"]) {
        console.log("[DEBUG] Skipping stale vote update event:", data.timestamp)
        return
      }

      // Update the last timestamp
      if (data.timestamp) {
        lastEventTimestampRef.current["vote-update"] = data.timestamp
      }

      console.log("[DEBUG] VOTE_UPDATE event received:", data)
      if (currentQuestionRef.current === data.questionId) {
        fetchVoteCounts(data.questionId)
      }
    },
    [fetchVoteCounts, currentQuestionRef],
  )

  // Handle question updated event
  const handleQuestionUpdated = useCallback(
    (data: any) => {
      // Check if this is a stale event (older than the last one we processed)
      if (data.timestamp && data.timestamp <= lastEventTimestampRef.current["question-update"]) {
        console.log("[DEBUG] Skipping stale question update event:", data.timestamp)
        return
      }

      // Update the last timestamp
      if (data.timestamp) {
        lastEventTimestampRef.current["question-update"] = data.timestamp
      }

      console.log("[DEBUG] QUESTION_UPDATE event received:", data)
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
        console.log("[DEBUG] Skipping stale loading question event:", data.timestamp)
        return
      }

      // Update the last timestamp
      if (data.timestamp) {
        lastEventTimestampRef.current["loading-question"] = data.timestamp
      }

      console.log("[DEBUG] LOADING_QUESTION event received:", data)
      setIsLoadingQuestion(true)
    },
    [setIsLoadingQuestion],
  )

  // Set up Pusher event listeners
  useEffect(() => {
    // Only set up event listeners if we have a game channel and haven't set them up yet
    if (!gameChannel || eventsSetupRef.current) return

    console.log("[DEBUG] Setting up Pusher event listeners")
    eventsSetupRef.current = true

    // Handle custom answer added event
    gameChannel.bind("custom-answer-added", handleCustomAnswerAdded)

    // Handle vote counts updated event
    gameChannel.bind("vote-update", handleVoteCountsUpdated)

    // Handle question updated event
    gameChannel.bind("question-update", handleQuestionUpdated)

    // Handle loading question event
    gameChannel.bind("loading-question", handleLoadingQuestion)

    return () => {
      console.log("[DEBUG] Cleaning up Pusher event listeners")
      if (gameChannel) {
        gameChannel.unbind("custom-answer-added", handleCustomAnswerAdded)
        gameChannel.unbind("vote-update", handleVoteCountsUpdated)
        gameChannel.unbind("question-update", handleQuestionUpdated)
        gameChannel.unbind("loading-question", handleLoadingQuestion)
      }
      eventsSetupRef.current = false
    }
  }, [gameChannel, handleCustomAnswerAdded, handleVoteCountsUpdated, handleQuestionUpdated, handleLoadingQuestion])
}
