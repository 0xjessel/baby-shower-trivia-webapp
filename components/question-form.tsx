"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PlusCircle, X } from "lucide-react"

interface QuestionFormProps {
  onSubmit: (formData: FormData) => Promise<{ success: boolean; error?: string }>
}

export default function QuestionForm({ onSubmit }: QuestionFormProps) {
  const [questionType, setQuestionType] = useState<"baby-picture" | "text">("baby-picture")
  const [options, setOptions] = useState<string[]>(["", "", "", ""])
  const [correctAnswer, setCorrectAnswer] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const addOption = () => {
    setOptions([...options, ""])
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return

    const newOptions = options.filter((_, i) => i !== index)
    setOptions(newOptions)

    if (correctAnswer >= newOptions.length) {
      setCorrectAnswer(0)
    } else if (correctAnswer > index) {
      setCorrectAnswer(correctAnswer - 1)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")
    setSuccess(false)

    const form = e.currentTarget
    const formData = new FormData(form)

    // Add options and correct answer to form data
    options.forEach((option, index) => {
      formData.append(`option_${index}`, option)
    })
    formData.append("correctAnswerIndex", correctAnswer.toString())

    try {
      const result = await onSubmit(formData)

      if (result.success) {
        setSuccess(true)
        form.reset()
        setOptions(["", "", "", ""])
        setCorrectAnswer(0)
        setQuestionType("baby-picture")
      } else {
        setError(result.error || "Failed to add question")
      }
    } catch (error) {
      console.error("Error submitting question:", error)
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="question-type">Question Type</Label>
          <RadioGroup
            value={questionType}
            onValueChange={(value) => setQuestionType(value as "baby-picture" | "text")}
            className="mt-2 flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="baby-picture" id="baby-picture" />
              <Label htmlFor="baby-picture">Baby Picture</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="text" id="text-question" />
              <Label htmlFor="text-question">Text Question</Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <Label htmlFor="question">Question</Label>
          <Textarea id="question" name="question" placeholder="Who is this baby?" className="mt-1" required />
        </div>

        {questionType === "baby-picture" && (
          <div>
            <Label htmlFor="image">Baby Picture</Label>
            <Input id="image" name="image" type="file" accept="image/*" className="mt-1" required />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <Label>Answer Options</Label>
            <Button type="button" variant="outline" size="sm" onClick={addOption} className="h-8 text-xs">
              <PlusCircle className="mr-1 h-3 w-3" />
              Add Option
            </Button>
          </div>

          <div className="mt-2 space-y-3">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <RadioGroupItem
                  value={index.toString()}
                  id={`correct-${index}`}
                  name="correctAnswer"
                  checked={correctAnswer === index}
                  onClick={() => setCorrectAnswer(index)}
                  className="text-pink-600"
                />
                <Input
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 2}
                  className="h-8 w-8 text-gray-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-600">Question added successfully!</div>}

      <Button type="submit" className="w-full bg-pink-600 hover:bg-pink-700" disabled={isSubmitting}>
        {isSubmitting ? "Adding Question..." : "Add Question"}
      </Button>
    </form>
  )
}
