"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PlusCircle, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"

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

    // Explicitly add the question type to the form data
    formData.append("type", questionType)

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
          <Label htmlFor="question-type" className="text-arcane-gray-light">
            Question Type
          </Label>
          <RadioGroup
            value={questionType}
            onValueChange={(value) => setQuestionType(value as "baby-picture" | "text")}
            className="mt-2 flex space-x-4"
            name="question-type" // Add name attribute
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="baby-picture" id="baby-picture" className="text-arcane-blue" />
              <Label htmlFor="baby-picture" className="text-arcane-gray-light">
                Baby Picture
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="text" id="text-question" className="text-arcane-blue" />
              <Label htmlFor="text-question" className="text-arcane-gray-light">
                Text Question
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <Label htmlFor="question" className="text-arcane-gray-light">
            Question
          </Label>
          <Textarea
            id="question"
            name="question"
            placeholder="Who is this baby?"
            className="mt-1 border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue"
            required
          />
        </div>

        {questionType === "baby-picture" && (
          <div>
            <Label htmlFor="image" className="text-arcane-gray-light">
              Baby Picture
            </Label>
            <Input
              id="image"
              name="image"
              type="file"
              accept="image/*"
              className="mt-1 border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue"
              required
            />
            <p className="mt-1 text-xs text-arcane-gray">Maximum file size: 5MB. Supported formats: JPG, PNG, GIF.</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-arcane-gray-light">Answer Options</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOption}
              className="h-8 text-xs border-arcane-gold text-arcane-gold hover:bg-arcane-gold/10"
            >
              <PlusCircle className="mr-1 h-3 w-3" />
              Add Option
            </Button>
          </div>

          <div className="mt-2 space-y-3">
            <RadioGroup
              value={correctAnswer.toString()}
              onValueChange={(value) => setCorrectAnswer(Number.parseInt(value))}
              name="correctAnswer"
            >
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <RadioGroupItem value={index.toString()} id={`correct-${index}`} className="text-arcane-blue" />
                  <Input
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(index)}
                    disabled={options.length <= 2}
                    className="h-8 w-8 text-arcane-gray"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="allows-custom-answers" className="text-arcane-gray-light">
            Allow Custom Answers
          </Label>
          <p className="text-xs text-arcane-gray">When enabled, guests can add their own answer options.</p>
        </div>
        <Switch
          id="allows-custom-answers"
          name="allows_custom_answers"
          defaultChecked={true}
          className="data-[state=checked]:bg-arcane-blue"
        />
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-900/20 border-red-500/50 text-red-400">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="default" className="bg-green-900/20 text-green-400 border-green-500/50">
          <AlertDescription>Question added successfully!</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        className="w-full bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Adding Question..." : "Add Question"}
      </Button>
    </form>
  )
}
