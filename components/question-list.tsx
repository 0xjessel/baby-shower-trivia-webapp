"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, PlayCircle, Users, Edit2 } from "lucide-react"
import { deleteQuestion, setActiveQuestion } from "@/app/actions"
import { usePusher } from "@/hooks/use-pusher"
import { EVENTS } from "@/lib/pusher-client"

interface Question {
  id: string
  type: "baby-picture" | "text"
  question: string
  imageUrl?: string
  options: string[]
  correctAnswer: string
  allowsCustomAnswers?: boolean
}

interface CustomAnswer {
  id: string
  text: string
  addedBy: string
}

interface VoteCounts {
  [option: string]: number
}

interface QuestionListProps {
  currentQuestionId?: string | null
}

export default function QuestionList({ currentQuestionId }: QuestionListProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({})
  const [voteCounts, setVoteCounts] = useState<Record<string, VoteCounts>>({})
  const [customAnswers, setCustomAnswers] = useState<Record<string, CustomAnswer[]>>({})
  const [totalVotes, setTotalVotes] = useState<Record<string, number>>({})
  const [editMode, setEditMode] = useState<Record<string, boolean>>({})
  const [editCorrectAnswer, setEditCorrectAnswer] = useState<Record<string, string>>( {})
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({})
  const { gameChannel } = usePusher()
  const [localCurrentQuestionId, setLocalCurrentQuestionId] = useState<string | null>(currentQuestionId || null)
  const lastVoteUpdateId = useRef<Record<string, string>>({})
  const fetchTimestamps = useRef<Record<string, number>>({})
  const fetchInProgress = useRef<Record<string, boolean>>({})

  // Fetch questions
  useEffect(() => {
    fetchQuestions()
  }, [])

  // Initialize all questions as expanded when questions are loaded
  useEffect(() => {
    if (questions.length > 0) {
      const allExpanded: Record<string, boolean> = {}
      questions.forEach((q) => {
        allExpanded[q.id] = true
      })
      setExpandedQuestions(allExpanded)
    }
  }, [questions])

  // Keep local state in sync with prop
  useEffect(() => {
    setLocalCurrentQuestionId(currentQuestionId || null)
  }, [currentQuestionId])

  // Fetch vote counts for a question
  const fetchVoteCounts = useCallback(async (questionId: string, retryCount = 0) => {
    // Check if a fetch is already in progress for this question
    const fetchKey = `votes-${questionId}`
    if (fetchInProgress.current[fetchKey]) {
      console.log(`[ADMIN] Fetch already in progress for question: ${questionId}`)
      return
    }

    // Add a simple cache to prevent duplicate fetches
    const now = Date.now()
    const lastFetch = fetchTimestamps.current[fetchKey] || 0
    const timeSinceLastFetch = now - lastFetch

    // Only fetch if it's been at least 2 seconds since the last fetch
    if (timeSinceLastFetch < 2000) {
      console.log(`[ADMIN] Skipping vote count fetch, last fetch was ${timeSinceLastFetch}ms ago`)
      return
    }

    // Mark fetch as in progress
    fetchInProgress.current[fetchKey] = true

    try {
      console.log(`[ADMIN] Fetching vote counts for question: ${questionId}`)
      const res = await fetch(`/api/vote-counts?questionId=${questionId}`, {
        // Add cache control headers
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })

      // Handle rate limiting
      if (res.status === 429) {
        const retryAfter = Number.parseInt(res.headers.get("Retry-After") || "10", 10)
        console.log(`[ADMIN] Vote counts rate limited. Retrying after ${retryAfter} seconds.`)

        if (retryCount < 3) {
          setTimeout(() => fetchVoteCounts(questionId, retryCount + 1), retryAfter * 1000)
        }
        fetchInProgress.current[fetchKey] = false
        return
      }

      if (!res.ok) {
        throw new Error(`Server responded with status: ${res.status}`)
      }

      const data = await res.json()

      if (data.voteCounts) {
        console.log("[ADMIN] Vote counts updated for question:", data.voteCounts)

        // Generate a unique ID for this update
        const updateId = `${questionId}-${data.timestamp || Date.now()}`

        // Only update if this is different from the last update we processed
        if (updateId !== lastVoteUpdateId.current[questionId]) {
          setVoteCounts((prev) => ({
            ...prev,
            [questionId]: data.voteCounts,
          }))
          setTotalVotes((prev) => ({
            ...prev,
            [questionId]: data.totalVotes,
          }))
          lastVoteUpdateId.current[questionId] = updateId

          // Update the timestamp after successful fetch
          fetchTimestamps.current[fetchKey] = now
        }
      }
    } catch (err) {
      console.error(`Error fetching vote counts for question ${questionId}:`, err)
      // If there's an error, we'll try again after a short delay (but not too often)
      if (retryCount < 3) {
        setTimeout(() => fetchVoteCounts(questionId, retryCount + 1), 5000)
      }
    } finally {
      // Mark fetch as complete
      fetchInProgress.current[fetchKey] = false
    }
  }, [])

  // Fetch custom answers for a question
  const fetchCustomAnswers = useCallback(
    async (questionId: string, retryCount = 0) => {
      // Check if a fetch is already in progress for this question
      const fetchKey = `customAnswers-${questionId}`
      if (fetchInProgress.current[fetchKey]) {
        console.log(`[ADMIN] Custom answers fetch already in progress for question: ${questionId}`)
        return
      }

      // Add a simple cache to prevent duplicate fetches
      const now = Date.now()
      const lastFetch = fetchTimestamps.current[fetchKey] || 0
      const timeSinceLastFetch = now - lastFetch

      // Only fetch if it's been at least 2 seconds since the last fetch
      if (timeSinceLastFetch < 2000) {
        console.log(`[ADMIN] Skipping custom answers fetch, last fetch was ${timeSinceLastFetch}ms ago`)
        return
      }

      // Mark fetch as in progress
      fetchInProgress.current[fetchKey] = true

      try {
        console.log(`[ADMIN] Fetching custom answers for question: ${questionId}`)
        const res = await fetch(`/api/custom-answers?questionId=${questionId}`, {
          // Add cache control headers
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        })

        // Handle rate limiting
        if (res.status === 429) {
          const retryAfter = Number.parseInt(res.headers.get("Retry-After") || "10", 10)
          console.log(`[ADMIN] Custom answers rate limited. Retrying after ${retryAfter} seconds.`)

          if (retryCount < 3) {
            setTimeout(() => fetchCustomAnswers(questionId, retryCount + 1), retryAfter * 1000)
          }
          fetchInProgress.current[fetchKey] = false
          return
        }

        if (!res.ok) {
          throw new Error(`Server responded with status: ${res.status}`)
        }

        const data = await res.json()

        if (data.customAnswers) {
          console.log("[ADMIN] Custom answers updated for question:", data.customAnswers.length)

          setCustomAnswers((prev) => ({
            ...prev,
            [questionId]: data.customAnswers,
          }))

          // If there are new custom answers, update vote counts to include them
          const currentCustomAnswers = customAnswers[questionId] || []
          if (data.customAnswers.length > currentCustomAnswers.length) {
            fetchVoteCounts(questionId)
          }

          // Update the timestamp after successful fetch
          fetchTimestamps.current[fetchKey] = now
        }
      } catch (err) {
        console.error(`Error fetching custom answers for question ${questionId}:`, err)
        // If there's an error, we'll try again after a short delay (but not too often)
        if (retryCount < 3) {
          setTimeout(() => fetchCustomAnswers(questionId, retryCount + 1), 5000)
        }
      } finally {
        // Mark fetch as complete
        fetchInProgress.current[fetchKey] = false
      }
    },
    [customAnswers, fetchVoteCounts],
  )

  // Set up Pusher event listeners
  useEffect(() => {
    if (!gameChannel) return

    // Listen for vote updates
    gameChannel.bind(EVENTS.VOTE_UPDATE, (data: { voteCounts: VoteCounts; totalVotes: number; questionId: string }) => {
      if (data.questionId && data.voteCounts) {
        console.log("[ADMIN] Real-time vote update received via Pusher for question:", data.questionId)

        // Generate a unique ID for this update
        const updateId = `${data.questionId}-${data.timestamp || Date.now()}`

        // Only update if this is different from the last update we processed
        if (updateId !== lastVoteUpdateId.current[data.questionId]) {
          setVoteCounts((prev) => ({
            ...prev,
            [data.questionId]: data.voteCounts,
          }))
          setTotalVotes((prev) => ({
            ...prev,
            [data.questionId]: data.totalVotes,
          }))
          lastVoteUpdateId.current[data.questionId] = updateId
        }
      }
    })

    // Listen for custom answer updates
    gameChannel.bind(EVENTS.CUSTOM_ANSWER_ADDED, (data: { customAnswer: CustomAnswer; questionId: string }) => {
      if (data.questionId && data.customAnswer) {
        console.log("[ADMIN] Real-time custom answer added via Pusher for question:", data.customAnswer.text)

        setCustomAnswers((prev) => {
          const currentAnswers = prev[data.questionId] || []
          // Check if we already have this custom answer
          if (!currentAnswers.some((ca) => ca.id === data.customAnswer.id)) {
            const updatedAnswers = [...currentAnswers, data.customAnswer]

            // Fetch updated vote counts when a new custom answer is added
            fetchVoteCounts(data.questionId)

            return {
              ...prev,
              [data.questionId]: updatedAnswers,
            }
          }
          return prev
        })
      }
    })

    return () => {
      gameChannel.unbind(EVENTS.VOTE_UPDATE)
      gameChannel.unbind(EVENTS.CUSTOM_ANSWER_ADDED)
    }
  }, [gameChannel, fetchVoteCounts])

  // Initial fetch for all questions
  useEffect(() => {
    if (questions.length > 0) {
      // Fetch vote counts and custom answers for all questions
      questions.forEach((question) => {
        fetchVoteCounts(question.id)
        fetchCustomAnswers(question.id)
      })
    }
  }, [questions, fetchVoteCounts, fetchCustomAnswers])

  // Fetch questions with retry logic
  const fetchQuestions = async (retryCount = 0) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/questions", {
        // Add cache control headers
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })

      // Check if we hit a rate limit
      if (response.status === 429) {
        const retryAfter = Number.parseInt(response.headers.get("Retry-After") || "10", 10)
        console.log(`[ADMIN] Rate limited. Retrying after ${retryAfter} seconds.`)

        // Wait and retry with exponential backoff
        if (retryCount < 3) {
          setTimeout(() => fetchQuestions(retryCount + 1), retryAfter * 1000)
        } else {
          setError("Rate limited. Please try again later.")
        }
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`)
      }

      const data = await response.json()

      if (data.questions) {
        setQuestions(data.questions)
      }
    } catch (err) {
      console.error("Error fetching questions:", err)
      setError("Failed to load questions. Please try refreshing the page.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      try {
        const result = await deleteQuestion(id)

        if (result.success) {
          setQuestions(questions.filter((q) => q.id !== id))
        } else {
          setError("Failed to delete question")
        }
      } catch (error) {
        console.error("Error deleting question:", error)
        setError("An unexpected error occurred")
      }
    }
  }

  const handleQuestionClick = async (questionId: string) => {
    try {
      // Immediately update local state for responsive UI
      setLocalCurrentQuestionId(questionId)

      // Set this question as the active question for all guests
      const result = await setActiveQuestion(questionId)

      if (result.success) {
        // Update data for the newly active question
        fetchVoteCounts(questionId)
        fetchCustomAnswers(questionId)
      } else {
        // Revert local state if the server action failed
        setLocalCurrentQuestionId(currentQuestionId)
        setError("Failed to set active question")
      }
    } catch (error) {
      console.error("Error setting active question:", error)
      // Revert local state if there was an error
      setLocalCurrentQuestionId(currentQuestionId)
      setError("An unexpected error occurred")
    }
  }

  const handleRetry = () => {
    setError("")
    fetchQuestions()
  }

  // Handler to toggle edit mode
  const handleEditClick = (questionId: string, currentCorrect: string) => {
    setEditMode((prev) => ({ ...prev, [questionId]: true }))
    setEditCorrectAnswer((prev) => ({ ...prev, [questionId]: currentCorrect }))
  }

  // Handler to cancel edit
  const handleCancelEdit = (questionId: string) => {
    setEditMode((prev) => ({ ...prev, [questionId]: false }))
  }

  // Handler to save the new correct answer
  const handleSaveCorrectAnswer = async (questionId: string) => {
    setIsSaving((prev) => ({ ...prev, [questionId]: true }))
    const newCorrect = editCorrectAnswer[questionId]
    try {
      const res = await fetch("/api/questions/correct-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, correctAnswer: newCorrect }),
      })
      const data = await res.json()
      if (data.success) {
        setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, correctAnswer: newCorrect } : q))
        setEditMode((prev) => ({ ...prev, [questionId]: false }))
      } else {
        alert(data.error || "Failed to update correct answer.")
      }
    } catch (err) {
      alert("Error updating correct answer.")
    } finally {
      setIsSaving((prev) => ({ ...prev, [questionId]: false }))
    }
  }

  // Handler for selecting a new correct answer
  const handleSelectCorrect = (questionId: string, option: string) => {
    setEditCorrectAnswer((prev) => ({ ...prev, [questionId]: option }))
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-arcane-blue/30 border-t-arcane-blue mx-auto"></div>
        <p className="text-arcane-gray">Loading questions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-900/20 p-4 text-center text-red-400 border border-red-500/50">
        {error}
        <Button
          onClick={handleRetry}
          variant="outline"
          size="sm"
          className="mt-2 border-arcane-blue text-arcane-blue hover:bg-arcane-blue/10"
        >
          Try Again
        </Button>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-arcane-gray">No questions added yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {questions.map((question) => {
        // Calculate total votes for this question
        const questionVotes = totalVotes[question.id] || 0

        return (
          <Card
            key={question.id}
            className={`border ${
              question.id === localCurrentQuestionId
                ? "border-arcane-gold border-2 shadow-lg shadow-arcane-gold/20"
                : "border-arcane-blue/30"
            } bg-arcane-navy/80 transition-all duration-200 hover:border-arcane-blue/60 cursor-pointer`}
            onClick={() => handleQuestionClick(question.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded-full bg-arcane-blue/20 px-2 py-1 text-xs font-medium text-arcane-blue">
                      {question.type === "baby-picture" ? "Baby Picture" : "Text Question"}
                    </span>

                    {question.id === localCurrentQuestionId && (
                      <span className="inline-flex items-center rounded-full bg-arcane-gold/20 px-2 py-1 text-xs font-medium text-arcane-gold">
                        <PlayCircle className="mr-1 h-3 w-3" />
                        Active
                      </span>
                    )}

                    {/* Vote count pill - always show for all questions */}
                    <span className="inline-flex items-center rounded-full bg-arcane-blue/10 px-2 py-1 text-xs font-medium text-arcane-blue">
                      <Users className="h-3 w-3 mr-1" />
                      {questionVotes} vote{questionVotes !== 1 ? "s" : ""}
                    </span>

                    {question.allowsCustomAnswers === false && (
                      <span className="inline-block rounded-full bg-arcane-gray/20 px-2 py-1 text-xs font-medium text-arcane-gray">
                        No Custom Answers
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-medium text-arcane-gray-light">{question.question}</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation() // Prevent triggering the card click
                    handleDelete(question.id)
                  }}
                  className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
                  disabled={question.id === localCurrentQuestionId}
                  title={question.id === localCurrentQuestionId ? "Cannot delete active question" : "Delete question"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {question.imageUrl && (
                <div className="mt-2 h-20 w-20 overflow-hidden rounded-md">
                  <img
                    src={question.imageUrl || "/placeholder.svg"}
                    alt="Baby"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {/* Always show answer options for all questions */}
              <div className="mt-4 space-y-3">
                <div className="text-xs font-medium text-arcane-gray">Answer Options:</div>
                <div className="space-y-2">
                  {/* Original options */}
                  {question.options.map((option) => {
                    const voteCount = voteCounts[question.id]?.[option] || 0
                    const totalVotesForQuestion = totalVotes[question.id] || 0
                    const percentage =
                      totalVotesForQuestion > 0 ? Math.round((voteCount / totalVotesForQuestion) * 100) : 0

                    return (
                      <div
                        key={option}
                        className={`relative overflow-hidden rounded-md border border-arcane-blue/20 bg-arcane-navy/50 p-2 ${editMode[question.id] ? "cursor-pointer" : ""}`}
                        onClick={() => editMode[question.id] && handleSelectCorrect(question.id, option)}
                      >
                        {/* Background progress bar */}
                        <div
                          className={`absolute inset-0 ${option === question.correctAnswer ? "bg-green-500/10" : "bg-arcane-blue/10"}`}
                          style={{ width: `${percentage}%` }}
                        />
                        <div className="relative flex items-center justify-between z-10">
                          <div className="flex-1">
                            <span
                              className={
                                option === question.correctAnswer
                                  ? "text-green-500 font-medium"
                                  : "text-arcane-gray-light"
                              }
                            >
                              {option} {option === question.correctAnswer && "(Correct)"}
                              {editMode[question.id] && editCorrectAnswer[question.id] === option && (
                                <span className="ml-2 text-xs text-arcane-gold">[Selected]</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center text-xs text-arcane-gold">
                            <Users className="h-3 w-3 mr-1" />
                            <span>{voteCount}</span>
                            {totalVotesForQuestion > 0 && <span className="ml-1">({percentage}%)</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Custom answers */}
                  {customAnswers[question.id]?.map((customAnswer) => {
                    const voteCount = voteCounts[question.id]?.[customAnswer.text] || 0
                    const totalVotesForQuestion = totalVotes[question.id] || 0
                    const percentage =
                      totalVotesForQuestion > 0 ? Math.round((voteCount / totalVotesForQuestion) * 100) : 0

                    return (
                      <div
                        key={customAnswer.id}
                        className="relative overflow-hidden rounded-md border border-arcane-gold/20 bg-arcane-navy/50 p-2"
                      >
                        {/* Background progress bar */}
                        <div className="absolute inset-0 bg-arcane-gold/10" style={{ width: `${percentage}%` }} />
                        <div className="relative flex items-center justify-between z-10">
                          <div className="flex-1">
                            <span className="text-arcane-gray-light">{customAnswer.text}</span>
                            <div className="text-xs text-arcane-gold">Added by {customAnswer.addedBy}</div>
                          </div>
                          <div className="flex items-center text-xs text-arcane-gold">
                            <Users className="h-3 w-3 mr-1" />
                            <span>{voteCount}</span>
                            {totalVotesForQuestion > 0 && <span className="ml-1">({percentage}%)</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Edit and Save/Cancel Controls for Admin */}
              <div className="flex gap-2 mt-2">
                {!editMode[question.id] && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1"
                    onClick={() => handleEditClick(question.id, question.correctAnswer)}
                  >
                    <Edit2 className="h-4 w-4" /> Edit Correct Answer
                  </Button>
                )}
                {editMode[question.id] && (
                  <>
                    <Button
                      size="sm"
                      variant="success"
                      className="flex items-center gap-1"
                      onClick={() => handleSaveCorrectAnswer(question.id)}
                      disabled={isSaving[question.id]}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancelEdit(question.id)}
                      disabled={isSaving[question.id]}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
