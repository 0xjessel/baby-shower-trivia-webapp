"use client"

import { useState, useRef, useCallback } from "react"
import type { VoteCounts } from "@/types/game"
import { submitAnswer } from "@/app/actions"
import { getApiOptions, generateUpdateId } from "@/lib/game-utils"

export function useAnswerState() {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("")
  const [submittedAnswer, setSubmittedAnswer] = useState<string>("")
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({})
  const [totalVotes, setTotalVotes] = useState(0)
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)

  // Track the last vote update we received to avoid duplicates
  const lastVoteUpdateId = useRef<string | null>(null)

  // Fetch vote counts for the current question
  const fetchVoteCounts = useCallback(async (questionId: string, currentQuestionId: string | null) => {
    if (!questionId) return null

    try {
      console.log("Fetching vote counts for question:", questionId)
      const res = await fetch(`/api/vote-counts?questionId=${questionId}`, getApiOptions())

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`)
      }

      const data = await res.json()

      if (data.voteCounts && questionId === currentQuestionId) {
        console.log("Vote counts received:", data.voteCounts, "Total:", data.totalVotes)

        // Generate a unique ID for this update
        const updateId = generateUpdateId(questionId, data.timestamp)

        // Only update if this is different from the last update we processed
        if (updateId !== lastVoteUpdateId.current) {
          setVoteCounts(data.voteCounts)
          setTotalVotes(data.totalVotes)
          lastVoteUpdateId.current = updateId
          return { voteCounts: data.voteCounts, totalVotes: data.totalVotes }
        }
      }
      return null
    } catch (err) {
      console.error("Error fetching vote counts:", err)
      return null
    }
  }, [])

  // Handle answer selection
  const handleAnswerChange = useCallback(
    async (value: string, currentQuestion: any, timeIsUp: boolean) => {
      if (!currentQuestion || timeIsUp) return false

      // If the user clicks on the same option they've already selected, do nothing
      if (value === selectedAnswer) return false

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
            return true
          } else {
            console.error("Error submitting answer:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error submitting answer:", error)
          return false
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
            return true
          } else {
            console.error("Error changing answer:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error changing answer:", error)
          return false
        } finally {
          setIsSubmittingAnswer(false)
        }
      }

      return true
    },
    [selectedAnswer, submittedAnswer, hasSubmitted],
  )

  // Initialize vote counts for a new question
  const initializeVoteCounts = useCallback((question: any, customAnswers: any[]) => {
    const initialVoteCounts: VoteCounts = {}

    // Add initial vote counts for question options
    if (question && question.options) {
      question.options.forEach((option: string) => {
        initialVoteCounts[option] = 0
      })
    }

    // Add initial vote counts for custom answers
    if (customAnswers && customAnswers.length > 0) {
      customAnswers.forEach((ca: any) => {
        initialVoteCounts[ca.text] = 0
      })
    }

    setVoteCounts(initialVoteCounts)
    setTotalVotes(0)
  }, [])

  return {
    // State
    selectedAnswer,
    submittedAnswer,
    hasSubmitted,
    voteCounts,
    totalVotes,
    isSubmittingAnswer,

    // Refs
    lastVoteUpdateId,

    // Methods
    setSelectedAnswer,
    setSubmittedAnswer,
    setHasSubmitted,
    setVoteCounts,
    setTotalVotes,
    fetchVoteCounts,
    handleAnswerChange,
    initializeVoteCounts,
  }
}
