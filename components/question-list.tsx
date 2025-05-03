"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, PlayCircle } from "lucide-react"
import { deleteQuestion, setActiveQuestion } from "@/app/actions"
import { toast } from "@/hooks/use-toast"

interface Question {
  id: string
  type: "baby-picture" | "text"
  question: string
  imageUrl?: string
  options: string[]
  correctAnswer: string
  allowsCustomAnswers?: boolean
}

interface QuestionListProps {
  currentQuestionId?: string | null
}

export default function QuestionList({ currentQuestionId }: QuestionListProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isSettingActive, setIsSettingActive] = useState(false)

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/questions")
      const data = await response.json()

      if (data.questions) {
        setQuestions(data.questions)
      }
    } catch (err) {
      console.error("Error fetching questions:", err)
      setError("Failed to load questions")
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

  const handleSetActive = async (id: string) => {
    if (id === currentQuestionId) {
      return // Already active
    }

    setIsSettingActive(true)
    try {
      const result = await setActiveQuestion(id)

      if (result.success) {
        toast({
          title: "Question activated",
          description: "This question is now active for all participants",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to activate question",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error setting active question:", error)
      toast({
        title: "Error",
        description: "Failed to activate question",
        variant: "destructive",
      })
    } finally {
      setIsSettingActive(false)
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
      {questions.map((question, index) => (
        <Card
          key={question.id}
          className={`border ${
            question.id === currentQuestionId
              ? "border-arcane-gold border-2 shadow-lg shadow-arcane-gold/20"
              : "border-arcane-blue/30"
          } bg-arcane-navy/80 transition-all duration-200 hover:border-arcane-blue/60 cursor-pointer`}
          onClick={() => handleSetActive(question.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-full bg-arcane-blue/20 px-2 py-1 text-xs font-medium text-arcane-blue">
                    {question.type === "baby-picture" ? "Baby Picture" : "Text Question"}
                  </span>

                  {question.id === currentQuestionId && (
                    <span className="inline-flex items-center rounded-full bg-arcane-gold/20 px-2 py-1 text-xs font-medium text-arcane-gold">
                      <PlayCircle className="mr-1 h-3 w-3" />
                      Active
                    </span>
                  )}

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
                disabled={question.id === currentQuestionId}
                title={question.id === currentQuestionId ? "Cannot delete active question" : "Delete question"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {question.imageUrl && (
              <div className="mt-2 h-20 w-20 overflow-hidden rounded-md">
                <img src={question.imageUrl || "/placeholder.svg"} alt="Baby" className="h-full w-full object-cover" />
              </div>
            )}

            <div className="mt-3">
              <p className="text-xs font-medium text-arcane-gray">Options:</p>
              <ul className="mt-1 space-y-1 text-sm">
                {question.options.map((option, i) => (
                  <li
                    key={i}
                    className={option === question.correctAnswer ? "font-medium text-arcane-gold" : "text-arcane-gray"}
                  >
                    {option} {option === question.correctAnswer && "(Correct)"}
                  </li>
                ))}
              </ul>
            </div>

            {question.id !== currentQuestionId && (
              <div className="mt-3 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-arcane-blue text-arcane-blue hover:bg-arcane-blue/10"
                  onClick={(e) => {
                    e.stopPropagation() // Prevent triggering the card click
                    handleSetActive(question.id)
                  }}
                  disabled={isSettingActive}
                >
                  {isSettingActive ? "Setting Active..." : "Set as Active Question"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
