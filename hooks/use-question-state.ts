"use client"

import { useState, useRef, useCallback } from "react"
import type { Question, CustomAnswer } from "@/types/game"
import { getApiOptions } from "@/lib/game-utils"

export function useQuestionState() {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [isWaiting, setIsWaiting] = useState(true)
  const [timerActive, setTimerActive] = useState(false)
  const [timerReset, setTimerReset] = useState(0)
  const [timeIsUp, setTimeIsUp] = useState(false)
  const [customAnswers, setCustomAnswers] = useState<CustomAnswer[]>([])

  // Track the current question ID for cleanup
  const currentQuestionRef = useRef<string | null>(null)

  // Fetch current question
  const fetchCurrentQuestion = useCallback(async () => {
    try {
      console.log("Fetching current question...")

      const res = await fetch("/api/current-question", getApiOptions())

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
        return { waiting: true, gameStatus: data.gameStatus }
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

          return {
            newQuestion: true,
            question: data.question,
            customAnswers: data.customAnswers || [],
            answered: data.answered,
            selectedAnswer: data.selectedAnswer,
            gameStatus: data.gameStatus,
          }
        } else {
          // Same question, just check if the game state has changed
          if (data.gameStatus === "results" && !timeIsUp) {
            console.log("Game state changed to results")
            setTimeIsUp(true)
          }

          return {
            newQuestion: false,
            question: data.question,
            customAnswers: data.customAnswers || [],
            answered: data.answered,
            selectedAnswer: data.selectedAnswer,
            gameStatus: data.gameStatus,
          }
        }
      }

      return { error: "No question data" }
    } catch (err) {
      console.error("Error fetching current question:", err)
      return { error: String(err) }
    }
  }, [currentQuestion, timeIsUp])

  // Handle timer expiration
  const handleTimeUp = useCallback(() => {
    setTimeIsUp(true)
    return currentQuestionRef.current
  }, [])

  return {
    // State
    currentQuestion,
    isWaiting,
    timerActive,
    timerReset,
    timeIsUp,
    customAnswers,

    // Refs
    currentQuestionRef,

    // Methods
    setCurrentQuestion,
    setIsWaiting,
    setTimerActive,
    setTimerReset,
    setTimeIsUp,
    setCustomAnswers,
    fetchCurrentQuestion,
    handleTimeUp,
  }
}
