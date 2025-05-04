"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { deleteQuestion, setActiveQuestion } from "@/app/actions"
import { toast } from "@/hooks/use-toast"
import { MoreVertical, Edit, Trash2, CheckCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Question {
  id: string
  type: "baby-picture" | "text"
  question: string
  imageUrl?: string
  options: string[]
  correctAnswer: string
  allowsCustomAnswers: boolean
}

interface QuestionListProps {
  currentQuestionId: string | null
}

export default function QuestionList({ currentQuestionId }: QuestionListProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isActionInProgress, setIsActionInProgress] = useState(false)

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
    } catch (error) {
      console.error("Error fetching questions:", error)
      toast({
        title: "Error",
        description: "Failed to load questions. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteQuestion = async (id: string) => {
    if (isActionInProgress) return

    setIsActionInProgress(true)
    try {
      const result = await deleteQuestion(id)
      if (result.success) {
        toast({
          title: "Success",
          description: "Question deleted successfully",
        })
        await fetchQuestions() // Refresh questions
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete question",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to delete question:", error)
      toast({
        title: "Error",
        description: "Failed to delete question. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsActionInProgress(false)
    }
  }

  const handleSetActiveQuestion = async (id: string) => {
    if (isActionInProgress) return

    setIsActionInProgress(true)
    try {
      const result = await setActiveQuestion(id)
      if (result.success) {
        toast({
          title: "Success",
          description: "Set question as active",
        })
        await fetchQuestions() // Refresh questions
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to set active question",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to set active question:", error)
      toast({
        title: "Error",
        description: "Failed to set active question. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsActionInProgress(false)
    }
  }

  if (isLoading) {
    return <p className="text-arcane-gray">Loading questions...</p>
  }

  return (
    <div className="space-y-3">
      {questions.map((question) => (
        <Card
          key={question.id}
          className={`border-2 shadow-md bg-arcane-navy/80 ${
            question.id === currentQuestionId ? "border-arcane-gold" : "border-arcane-blue/50"
          }`}
        >
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <h3 className="text-lg font-semibold text-arcane-gray-light">{question.question}</h3>
              <p className="text-sm text-arcane-gray">Type: {question.type}</p>
            </div>
            <div className="flex items-center space-x-2">
              {question.id === currentQuestionId && (
                <CheckCircle className="h-5 w-5 text-green-500" title="Current Question" />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleSetActiveQuestion(question.id)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Set Active
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleDeleteQuestion(question.id)} className="text-red-500">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
