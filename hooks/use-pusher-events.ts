"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import { pusherClient } from "@/lib/pusher-client"
import type { Question, CustomAnswer } from "@/types/game"

export function usePusherEvents(
  currentQuestionRef: React.MutableRefObject<Question | null>,
  customAnswers: CustomAnswer[],
  setCustomAnswers: (answers: CustomAnswer[]) => void,
  setVoteCounts: (counts: any) => void,
  setTotalVotes: (total: number) => void,
  fetchCurrentQuestion: () => Promise<any>,
  fetchVoteCounts: (questionId: string, updateId?: string) => Promise<void>,
  setIsLoadingQuestion: (isLoading: boolean) => void,
) {
  // Use a ref to track if events have been set up
  const eventsSetupRef = useRef(false)

  // Set up Pusher events
  useEffect(() => {
    // Skip if events are already set up
    if (eventsSetupRef.current) return

    console.log("[DEBUG] Setting up Pusher events")

    // Subscribe to the game channel
    const channel = pusherClient.subscribe("game-events")

    // Handle new question event
    const handleNewQuestion = (data: any) => {
      console.log("[DEBUG] New question event received:", data)
      setIsLoadingQuestion(false)
      fetchCurrentQuestion()
    }

    // Handle loading question event
    const handleLoadingQuestion = () => {
      console.log("[DEBUG] Loading question event received")
      setIsLoadingQuestion(true)
    }

    // Handle vote update event
    const handleVoteUpdate = (data: any) => {
      console.log("[DEBUG] Vote update event received:", data)
      if (data.questionId === currentQuestionRef.current?.id) {
        setVoteCounts(data.voteCounts)
        setTotalVotes(data.totalVotes)
      }
    }

    // Handle custom answer added event
    const handleCustomAnswerAdded = (data: any) => {
      console.log("[DEBUG] Custom answer added event received:", data)
      if (data.questionId === currentQuestionRef.current?.id) {
        // Check if we already have this custom answer
        const exists = customAnswers.some((ca) => ca.id === data.customAnswer.id || ca.text === data.customAnswer.text)

        if (!exists) {
          console.log("[DEBUG] Adding new custom answer to state:", data.customAnswer)
          setCustomAnswers([...customAnswers, data.customAnswer])
        } else {
          console.log("[DEBUG] Custom answer already exists, not adding duplicate")
        }
      }
    }

    // Bind events
    channel.bind("new-question", handleNewQuestion)
    channel.bind("loading-question", handleLoadingQuestion)
    channel.bind("vote-update", handleVoteUpdate)
    channel.bind("custom-answer-added", handleCustomAnswerAdded)

    // Mark events as set up
    eventsSetupRef.current = true

    // Clean up
    return () => {
      console.log("[DEBUG] Cleaning up Pusher events")
      channel.unbind("new-question", handleNewQuestion)
      channel.unbind("loading-question", handleLoadingQuestion)
      channel.unbind("vote-update", handleVoteUpdate)
      channel.unbind("custom-answer-added", handleCustomAnswerAdded)
      pusherClient.unsubscribe("game-events")
    }
  }, [
    currentQuestionRef,
    customAnswers,
    setCustomAnswers,
    setVoteCounts,
    setTotalVotes,
    fetchCurrentQuestion,
    fetchVoteCounts,
    setIsLoadingQuestion,
  ])
}
