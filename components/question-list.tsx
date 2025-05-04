"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, PlayCircle, Users } from "lucide-react"
import { deleteQuestion, setActiveQuestion } from "@/app/actions"
import { usePusher } from "@/hooks/use-pusher"
import { EVENTS } from "@/lib/pusher-client"
import { debounce } from "@/lib/debounce"

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
  // All questions are expanded by default
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({})
  const [voteCounts, setVoteCounts] = useState<Record<string, VoteCounts>>({})
  const [customAnswers, setCustomAnswers] = useState<Record<string, CustomAnswer[]>>({})
  const [totalVotes, setTotalVotes] = useState<Record<string, number>>({})
  const [activePlayers, setActivePlayers] = useState(0)
  const [activityTimeout, setActivityTimeout] = useState(120) // Default 2 minutes in seconds
  const { gameChannel } = usePusher()
  const [localCurrentQuestionId, setLocalCurrentQuestionId] = useState<string | null>(currentQuestionId || null)

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

  // Set up Pusher event listeners
  useEffect(() => {
    if (!gameChannel) return

    // Listen for vote updates
    gameChannel.bind(EVENTS.VOTE_UPDATE, (data: { voteCounts: VoteCounts; totalVotes: number; questionId: string }) => {
      if (data.questionId && data.voteCounts) {
        setVoteCounts((prev) => ({
          ...prev,
          [data.questionId]: data.voteCounts,
        }))
        setTotalVotes((prev) => ({
          ...prev,
          [data.questionId]: data.totalVotes,
        }))
      }
    })

    // Listen for custom answer updates
    gameChannel.bind(EVENTS.CUSTOM_ANSWER_ADDED, (data: { customAnswer: CustomAnswer; questionId: string }) => {
      if (data.questionId && data.customAnswer) {
        setCustomAnswers((prev) => ({
          ...prev,
          [data.questionId]: [...(prev[data.questionId] || []), data.customAnswer],
        }))
      }
    })

    return () => {
      gameChannel.unbind(EVENTS.VOTE_UPDATE)
      gameChannel.unbind(EVENTS.CUSTOM_ANSWER_ADDED)
    }
  }, [gameChannel])

  // Poll for active players count
  useEffect(() => {
    const fetchActivePlayers = async () => {
      try {
        const res = await fetch("/api/online-players")
        const data = await res.json()
        if (data.count !== undefined) {
          setActivePlayers(data.count)
        }
        if (data.activeTimeout) {
          setActivityTimeout(data.activeTimeout)
        }
      } catch (err) {
        console.error("Error fetching active players:", err)
      }
    }

    fetchActivePlayers()
    const interval = setInterval(fetchActivePlayers, 10000) // Poll every 10 seconds

    return () => clearInterval(interval)
  }, [])

  const fetchQuestions = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/questions")
      const data = await response.json()

      if (data.questions) {
        setQuestions(data.questions)

        // Fetch vote counts for all questions
        data.questions.forEach((question: Question) => {
          fetchVoteCounts(question.id)
          fetchCustomAnswers(question.id)
        })
      }
    } catch (err) {
      console.error("Error fetching questions:", err)
      setError("Failed to load questions")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchVoteCounts = async (questionId: string) => {
    try {
      const res = await fetch(`/api/vote-counts?questionId=${questionId}`)
      const data = await res.json()

      if (data.voteCounts) {
        setVoteCounts((prev) => ({
          ...prev,
          [questionId]: data.voteCounts,
        }))
        setTotalVotes((prev) => ({
          ...prev,
          [questionId]: data.totalVotes,
        }))
      }
    } catch (err) {
      console.error(`Error fetching vote counts for question ${questionId}:`, err)
    }
  }

  const fetchCustomAnswers = async (questionId: string) => {
    try {
      const res = await fetch(`/api/custom-answers?questionId=${questionId}`)
      const data = await res.json()

      if (data.customAnswers) {
        setCustomAnswers((prev) => ({
          ...prev,
          [questionId]: data.customAnswers,
        }))
      }
    } catch (err) {
      console.error(`Error fetching custom answers for question ${questionId}:`, err)
    }
  }

  // Create a debounced version of fetchVoteCounts
  const debouncedFetchVoteCounts = useCallback(
    debounce((questionId: string) => {
      fetchVoteCounts(questionId)
    }, 2000),
    [],
  )

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
          onClick={fetchQuestions}
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
      {questions.map((question) => (
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
                    <>
                      <span className="inline-flex items-center rounded-full bg-arcane-gold/20 px-2 py-1 text-xs font-medium text-arcane-gold">
                        <PlayCircle className="mr-1 h-3 w-3" />
                        Active
                      </span>
                      <span className="inline-flex items-center rounded-full bg-arcane-blue/20 px-2 py-1 text-xs font-medium text-arcane-blue ml-1">
                        <Users className="mr-1 h-3 w-3" />
                        {totalVotes[question.id] || 0}/{activePlayers}
                      </span>
                    </>
                  )}

                  {question.allowsCustomAnswers === false && (
                    <span className="inline-block rounded-full bg-arcane-gray/20 px-2 py-1 text-xs font-medium text-arcane-gray">
                      No Custom Answers
                    </span>
                  )}

                  {totalVotes[question.id] > 0 && (
                    <span className="inline-flex items-center rounded-full bg-arcane-blue/10 px-2 py-1 text-xs font-medium text-arcane-blue">
                      <Users className="mr-1 h-3 w-3" />
                      {totalVotes[question.id]} vote{totalVotes[question.id] !== 1 ? "s" : ""}
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
                <img src={question.imageUrl || "/placeholder.svg"} alt="Baby" className="h-full w-full object-cover" />
              </div>
            )}

            {expandedQuestions[question.id] && (
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
                        className="relative overflow-hidden rounded-md border border-arcane-blue/20 bg-arcane-navy/50 p-2"
                      >
                        {/* Background progress bar */}
                        <div
                          className={`absolute inset-0 ${option === question.correctAnswer ? "bg-green-500/10" : "bg-arcane-blue/10"}`}
                          style={{ width: `${percentage}%` }}
                        />
                        <div className="relative flex items-center justify-between z-10">
                          <div className="flex-1">
                            <span
                              className={`${option === question.correctAnswer ? "text-green-500 font-medium" : "text-arcane-gray-light"}`}
                            >
                              {option} {option === question.correctAnswer && "(Correct)"}
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

                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 text-xs border-arcane-blue/30 text-arcane-blue hover:bg-arcane-blue/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    fetchVoteCounts(question.id)
                    fetchCustomAnswers(question.id)
                  }}
                >
                  Refresh Data
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
