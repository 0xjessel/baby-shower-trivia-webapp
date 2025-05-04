"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from "lucide-react"
import { usePusher } from "@/hooks/use-pusher"
import { EVENTS } from "@/lib/constants"
import { debounce } from "@/lib/debounce"
import type { Question, CustomAnswer, VoteCounts } from "@/types/game"

interface ActiveQuestionDisplayProps {
  initialQuestion: Question | null
  initialCustomAnswers: CustomAnswer[]
  initialVoteCounts: VoteCounts
  initialTotalVotes: number
}

export default function ActiveQuestionDisplay({
  initialQuestion,
  initialCustomAnswers = [],
  initialVoteCounts = {},
  initialTotalVotes = 0,
}: ActiveQuestionDisplayProps) {
  const [question, setQuestion] = useState<Question | null>(initialQuestion)
  const [customAnswers, setCustomAnswers] = useState<CustomAnswer[]>(initialCustomAnswers)
  const [voteCounts, setVoteCounts] = useState<VoteCounts>(initialVoteCounts)
  const [totalVotes, setTotalVotes] = useState<number>(initialTotalVotes)
  const [isLoading, setIsLoading] = useState(false)
  const { gameChannel } = usePusher()

  // Use refs to track the latest state without triggering effect dependencies
  const questionRef = useRef(question)
  const lastFetchTimeRef = useRef(0)
  const isMountedRef = useRef(true)

  // Update refs when state changes
  useEffect(() => {
    questionRef.current = question
    return () => {
      isMountedRef.current = false
    }
  }, [question])

  // Debounced fetch function to prevent too many API calls
  const debouncedFetchVoteCounts = useCallback(
    debounce(async (questionId: string) => {
      // Skip if no question ID or if we fetched recently (within 2 seconds)
      if (!questionId || Date.now() - lastFetchTimeRef.current < 2000) {
        return
      }

      // Skip if component unmounted
      if (!isMountedRef.current) return

      try {
        setIsLoading(true)
        lastFetchTimeRef.current = Date.now()

        const response = await fetch(`/api/vote-counts?questionId=${questionId}`, {
          headers: {
            "Cache-Control": "no-cache",
          },
        })

        if (response.ok && isMountedRef.current) {
          const data = await response.json()
          setVoteCounts(data.voteCounts || {})
          setTotalVotes(data.totalVotes || 0)
        }
      } catch (error) {
        console.error("Error fetching vote counts:", error)
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    }, 500), // 500ms debounce
    [],
  )

  // Fetch current question data - only called when question changes
  const fetchCurrentQuestion = useCallback(async () => {
    // Skip if we fetched recently (within 2 seconds)
    if (Date.now() - lastFetchTimeRef.current < 2000) {
      return
    }

    try {
      setIsLoading(true)
      lastFetchTimeRef.current = Date.now()

      const response = await fetch("/api/current-question", {
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      if (response.ok && isMountedRef.current) {
        const data = await response.json()
        if (data.question) {
          setQuestion(data.question)
          setCustomAnswers(data.customAnswers || [])

          // Only fetch vote counts if the question ID changed
          if (!questionRef.current || questionRef.current.id !== data.question.id) {
            debouncedFetchVoteCounts(data.question.id)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching current question:", error)
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [debouncedFetchVoteCounts])

  // Set up Pusher event listeners for real-time updates
  useEffect(() => {
    if (!gameChannel) return

    // Handle vote count updates directly from the Pusher event
    const handleVoteUpdate = (data: any) => {
      if (!questionRef.current || questionRef.current.id !== data.questionId) {
        return
      }

      // Update directly from the event data if available
      if (data.voteCounts && data.totalVotes !== undefined) {
        setVoteCounts(data.voteCounts)
        setTotalVotes(data.totalVotes)
      } else {
        // Fallback to API call if event doesn't contain the data
        debouncedFetchVoteCounts(data.questionId)
      }
    }

    // Handle custom answer additions
    const handleCustomAnswerAdded = (data: any) => {
      if (!questionRef.current || questionRef.current.id !== data.questionId) {
        return
      }

      // Add the new custom answer if it doesn't already exist
      if (data.customAnswer) {
        setCustomAnswers((prev) => {
          const exists = prev.some((ca) => ca.id === data.customAnswer.id)
          if (!exists) {
            return [...prev, data.customAnswer]
          }
          return prev
        })
      }
    }

    // Handle question updates - fetch new question data
    const handleQuestionUpdate = () => {
      fetchCurrentQuestion()
    }

    // Bind to events
    gameChannel.bind(EVENTS.VOTE_COUNTS_UPDATED, handleVoteUpdate)
    gameChannel.bind(EVENTS.CUSTOM_ANSWER_ADDED, handleCustomAnswerAdded)
    gameChannel.bind("question-update", handleQuestionUpdate)
    gameChannel.bind(EVENTS.NEW_QUESTION, handleQuestionUpdate)

    // Clean up
    return () => {
      gameChannel.unbind(EVENTS.VOTE_COUNTS_UPDATED, handleVoteUpdate)
      gameChannel.unbind(EVENTS.CUSTOM_ANSWER_ADDED, handleCustomAnswerAdded)
      gameChannel.unbind("question-update", handleQuestionUpdate)
      gameChannel.unbind(EVENTS.NEW_QUESTION, handleQuestionUpdate)
    }
  }, [gameChannel, fetchCurrentQuestion, debouncedFetchVoteCounts])

  // Refresh data periodically as a fallback - but much less frequently
  useEffect(() => {
    if (!question) return

    const interval = setInterval(() => {
      debouncedFetchVoteCounts(question.id)
    }, 30000) // Refresh every 30 seconds instead of 10

    return () => clearInterval(interval)
  }, [question, debouncedFetchVoteCounts])

  // Initial data fetch - only if we don't have initial data
  useEffect(() => {
    if (!initialQuestion && !question) {
      fetchCurrentQuestion()
    }
  }, [initialQuestion, question, fetchCurrentQuestion])

  if (!question) {
    return (
      <Card className="border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
        <CardHeader>
          <CardTitle className="text-xl text-arcane-blue">Active Question</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-arcane-gray">No active question</p>
        </CardContent>
      </Card>
    )
  }

  // Combine predefined options and custom answers
  const allOptions = [
    ...question.options.map((option) => ({
      text: option,
      isCustom: false,
      addedBy: null,
    })),
    ...customAnswers.map((ca) => ({
      text: ca.text,
      isCustom: true,
      addedBy: ca.addedBy,
    })),
  ]

  return (
    <Card className="border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl text-arcane-blue">Active Question</CardTitle>
          <div className="flex items-center text-arcane-gray text-sm">
            <Users className="h-4 w-4 mr-1" />
            <span>{totalVotes} votes</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-arcane-blue mb-1">{question.question}</h3>

          {question.type === "baby-picture" && question.imageUrl && (
            <div className="mb-3 mt-2 overflow-hidden rounded-lg max-w-xs mx-auto">
              <img
                src={question.imageUrl || "/placeholder.svg"}
                alt="Baby Picture"
                className="h-auto w-full object-cover"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          {allOptions.map((option, index) => {
            const voteCount = voteCounts[option.text] || 0
            const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
            const isCorrectAnswer = !question.isOpinionQuestion && index === 0 // Assuming first option is correct

            return (
              <div
                key={`${option.isCustom ? "custom" : "option"}-${index}`}
                className={`relative flex items-center justify-between rounded-lg border p-3 transition-colors overflow-hidden
                  ${
                    isCorrectAnswer ? "border-arcane-gold bg-arcane-gold/10" : "border-arcane-blue/20 bg-arcane-navy/50"
                  }`}
              >
                {/* Background progress bar */}
                <div
                  className={`absolute inset-0 ${isCorrectAnswer ? "bg-arcane-gold/10" : "bg-arcane-blue/10"} z-0`}
                  style={{ width: `${percentage}%` }}
                />

                <div className="flex flex-col z-10">
                  <span className={`font-medium ${isCorrectAnswer ? "text-arcane-gold" : "text-arcane-gray-light"}`}>
                    {option.text}
                  </span>

                  {option.isCustom && option.addedBy && (
                    <span className="text-xs text-arcane-gold mt-0.5">Added by {option.addedBy}</span>
                  )}
                </div>

                <div className="flex items-center z-10">
                  <div className={`text-sm ${isCorrectAnswer ? "text-arcane-gold" : "text-arcane-gray"} mr-2`}>
                    {percentage}%
                  </div>
                  <div className="flex items-center text-xs text-arcane-gold">
                    <Users className="h-3 w-3 mr-1" />
                    <span>{voteCount}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
