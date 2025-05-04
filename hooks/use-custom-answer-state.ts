"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { toast } from "@/hooks/use-toast"
import type { CustomAnswer } from "@/types/game"
import { addCustomAnswer } from "@/app/actions"
import { isDuplicateCustomAnswer } from "@/lib/game-utils"

export function useCustomAnswerState(
  customAnswers: CustomAnswer[],
  setCustomAnswers: (answers: CustomAnswer[]) => void,
  setSelectedAnswer: (answer: string) => void,
  setVoteCounts: (counts: any) => void,
  setTotalVotes: (total: number) => void,
  setSubmittedAnswer: (answer: string) => void,
  setHasSubmitted: (submitted: boolean) => void,
) {
  const [newCustomAnswer, setNewCustomAnswer] = useState("")
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false)
  const [hasAddedCustomAnswer, setHasAddedCustomAnswer] = useState(false)

  // Handle custom answer submission
  const handleAddCustomAnswer = useCallback(
    async (e?: React.FormEvent, currentQuestion?: any, timeIsUp?: boolean, playerName?: string) => {
      // If an event was passed, prevent default behavior
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }

      if (!newCustomAnswer.trim() || !currentQuestion || timeIsUp) return false

      // Check for duplicates before submitting
      if (isDuplicateCustomAnswer(newCustomAnswer, customAnswers)) {
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
        const result = await addCustomAnswer(currentQuestion.id, newCustomAnswer.trim())

        if (result.success && result.customAnswer) {
          setNewCustomAnswer("")

          // Add the custom answer to the local state immediately
          const newCustomAnswerObj = result.customAnswer

          // Ensure the addedBy field is set
          if (!newCustomAnswerObj.addedBy && playerName) {
            newCustomAnswerObj.addedBy = playerName
          }

          // Check for duplicates before adding locally
          if (!isDuplicateCustomAnswer(newCustomAnswerObj, customAnswers)) {
            setCustomAnswers([...customAnswers, newCustomAnswerObj])
          }

          // Set the newly added answer as the selected answer
          setSelectedAnswer(newCustomAnswerObj.text)

          // Update vote counts optimistically
          setVoteCounts((prev: any) => ({
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

          return true
        } else {
          // Reset the flag if the submission failed
          setHasAddedCustomAnswer(false)
          toast({
            title: "Error",
            description: result.error || "Failed to add custom answer.",
            variant: "destructive",
          })
          return false
        }
      } catch (error) {
        // Reset the flag if there was an error
        setHasAddedCustomAnswer(false)
        toast({
          title: "Error",
          description: "Failed to add custom answer. Please try again.",
          variant: "destructive",
        })
        return false
      } finally {
        setIsSubmittingCustom(false)
      }
    },
    [
      newCustomAnswer,
      customAnswers,
      setCustomAnswers,
      setSelectedAnswer,
      setVoteCounts,
      setTotalVotes,
      setSubmittedAnswer,
      setHasSubmitted,
    ],
  )

  // Handle key press in custom answer input
  const handleCustomAnswerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, currentQuestion?: any, timeIsUp?: boolean, playerName?: string) => {
      if (e.key === "Enter") {
        e.preventDefault()
        if (newCustomAnswer.trim() && !isSubmittingCustom && !timeIsUp) {
          handleAddCustomAnswer(undefined, currentQuestion, timeIsUp, playerName)
        }
      }
    },
    [newCustomAnswer, isSubmittingCustom, handleAddCustomAnswer],
  )

  // Reset custom answer state
  const resetCustomAnswerState = useCallback(() => {
    setNewCustomAnswer("")
    setHasAddedCustomAnswer(false)
    setIsSubmittingCustom(false)
  }, [])

  return {
    // State
    newCustomAnswer,
    isSubmittingCustom,
    hasAddedCustomAnswer,

    // Methods
    setNewCustomAnswer,
    setIsSubmittingCustom,
    setHasAddedCustomAnswer,
    handleAddCustomAnswer,
    handleCustomAnswerKeyDown,
    resetCustomAnswerState,
  }
}
