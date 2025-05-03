"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2 } from "lucide-react"
import { deleteQuestion } from "@/app/actions"

interface Question {
  id: string
  type: "baby-picture" | "text"
  question: string
  imageUrl?: string
  options: string[]
  correctAnswer: string
}

export default function QuestionList() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

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

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600 mx-auto"></div>
        <p className="text-gray-600">Loading questions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-center text-red-600">
        {error}
        <Button onClick={fetchQuestions} variant="outline" size="sm" className="mt-2">
          Try Again
        </Button>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No questions added yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {questions.map((question, index) => (
        <Card key={question.id} className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block rounded-full bg-pink-100 px-2 py-1 text-xs font-medium text-pink-800">
                  {question.type === "baby-picture" ? "Baby Picture" : "Text Question"}
                </span>
                <h3 className="mt-2 font-medium">{question.question}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(question.id)}
                className="text-red-500 hover:bg-red-50 hover:text-red-600"
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
              <p className="text-xs font-medium text-gray-500">Options:</p>
              <ul className="mt-1 space-y-1 text-sm">
                {question.options.map((option, i) => (
                  <li key={i} className={option === question.correctAnswer ? "font-medium text-green-600" : ""}>
                    {option} {option === question.correctAnswer && "(Correct)"}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
