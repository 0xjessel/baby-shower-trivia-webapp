"use client"

import type React from "react"

import { useRef, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuestionState } from "./use-question-state"
import { useAnswerState } from "./use-answer-state"
import { useCustomAnswerState } from "./use-custom-answer-state"
import { usePusherEvents } from "./use-pusher-events"

export function useGameState() {
  const router = useRouter()
  const playerNameRef = useRef<string>("")
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)

  // Question state
  const {
    currentQuestion,
    isWaiting,
    timerActive,
    timerReset,
    timeIsUp,
    customAnswers,
    currentQuestionRef,
    setCurrentQuestion,
    setIsWaiting,
    setTimerActive,
    setTimerReset,
    setTimeIsUp,
    setCustomAnswers,
    fetchCurrentQuestion,
    handleTimeUp,
  } = useQuestionState()

  // Answer state
  const {
    selectedAnswer,
    submittedAnswer,
    hasSubmitted,
    voteCounts,
    totalVotes,
    isSubmittingAnswer,
    lastVoteUpdateId,
    setSelectedAnswer,
    setSubmittedAnswer,
    setHasSubmitted,
    setVoteCounts,
    setTotalVotes,
    fetchVoteCounts,
    handleAnswerChange,
    initializeVoteCounts,
  } = useAnswerState()

  // Custom answer state
  const {
    newCustomAnswer,
    isSubmittingCustom,
    hasAddedCustomAnswer,
    setNewCustomAnswer,
    setIsSubmittingCustom,
    setHasAddedCustomAnswer,
    handleAddCustomAnswer,
    handleCustomAnswerKeyDown,
  } = useCustomAnswerState(
    customAnswers,
    setCustomAnswers,
    setSelectedAnswer,
    setVoteCounts,
    setTotalVotes,
    setSubmittedAnswer,
    setHasSubmitted,
  )

  // Pusher events
  usePusherEvents(
    currentQuestionRef,
    customAnswers,
    setCustomAnswers,
    setVoteCounts,
    setTotalVotes,
    fetchCurrentQuestion,
    fetchVoteCounts,
    setIsLoadingQuestion,
  )

  // Use a ref to store the current state values that callbacks need
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

    // Fetch current question on initial load
    fetchCurrentQuestion().then((result) => {
      if (result && result.newQuestion && result.question) {
        // Initialize vote counts for the new question
        initializeVoteCounts(result.question, result.customAnswers)

        // If the user has already answered this question
        if (result.answered && result.selectedAnswer) {
          console.log("User already answered:", result.selectedAnswer)
          setSelectedAnswer(result.selectedAnswer)
          setSubmittedAnswer(result.selectedAnswer)
          setHasSubmitted(true)
        } else {
          setSelectedAnswer("")
          setSubmittedAnswer("")
          setHasSubmitted(false)
        }

        // Fetch initial vote counts
        fetchVoteCounts(result.question.id, result.question.id)
      }
    })
  }, [
    router,
    fetchCurrentQuestion,
    initializeVoteCounts,
    setSelectedAnswer,
    setSubmittedAnswer,
    setHasSubmitted,
    fetchVoteCounts,
  ])

  // Wrapper functions that use stateRef to access current state
  const wrappedHandleAnswerChange = (value: string) => {
    return handleAnswerChange(value, stateRef.current.currentQuestion, stateRef.current.timeIsUp)
  }

  const wrappedHandleAddCustomAnswer = (e?: React.FormEvent) => {
    return handleAddCustomAnswer(e, stateRef.current.currentQuestion, stateRef.current.timeIsUp, playerNameRef.current)
  }

  const wrappedHandleCustomAnswerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    return handleCustomAnswerKeyDown(
      e,
      stateRef.current.currentQuestion,
      stateRef.current.timeIsUp,
      playerNameRef.current,
    )
  }

  const wrappedHandleTimeUp = () => {
    const questionId = handleTimeUp()

    // If the user has selected an answer but didn't submit it, auto-submit
    if (selectedAnswer && !hasSubmitted && stateRef.current.currentQuestion) {
      setHasSubmitted(true)
      setSubmittedAnswer(selectedAnswer)

      handleAnswerChange(selectedAnswer, stateRef.current.currentQuestion, false).catch((error) => {
        console.error("Error auto-submitting answer:", error)
      })
    }
  }

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
    playerName: playerNameRef.current,
    customAnswers,
    newCustomAnswer,
    isSubmittingAnswer,
    isSubmittingCustom,
    hasAddedCustomAnswer,
    isLoadingQuestion,

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
    setIsLoadingQuestion,
    fetchCurrentQuestion,
    fetchVoteCounts,
    handleAnswerChange: wrappedHandleAnswerChange,
    handleTimeUp: wrappedHandleTimeUp,
    handleAddCustomAnswer: wrappedHandleAddCustomAnswer,
    handleCustomAnswerKeyDown: wrappedHandleCustomAnswerKeyDown,
  }
}
