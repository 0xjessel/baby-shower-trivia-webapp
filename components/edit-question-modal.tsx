"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { X, PlusCircle } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { updateQuestion } from "@/app/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Question {
  id: string
  type: "baby-picture" | "text"
  question: string
  imageUrl?: string
  options: string[]
  correctAnswer: string
  allowsCustomAnswers?: boolean
  noCorrectAnswer?: boolean
}

interface EditQuestionModalProps {
  question: Question | null
  onClose: () => void
  customAnswersCount?: number
}

export default function EditQuestionModal({ question, onClose, customAnswersCount = 0 }: EditQuestionModalProps) {
  const [questionText, setQuestionText] = useState("")
  const [options, setOptions] = useState<string[]>([])
  const [correctAnswer, setCorrectAnswer] = useState<number>(0)
  const [hasNoCorrectAnswer, setHasNoCorrectAnswer] = useState(false)
  const [allowsCustomAnswers, setAllowsCustomAnswers] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [showCustomAnswersWarning, setShowCustomAnswersWarning] = useState(false)

  useEffect(() => {
    if (question) {
      setQuestionText(question.question)
      setOptions([...question.options])
      setAllowsCustomAnswers(question.allowsCustomAnswers !== false)
      setHasNoCorrectAnswer(question.noCorrectAnswer === true)

      // Find the index of the correct answer in options
      const correctIndex = question.options.findIndex((opt) => opt === question.correctAnswer)
      setCorrectAnswer(correctIndex >= 0 ? correctIndex : 0)
    }
  }, [question])

  // Show warning when trying to disable custom answers if there are custom answers
  useEffect(() => {
    if (customAnswersCount > 0 && !allowsCustomAnswers) {
      setShowCustomAnswersWarning(true)
    } else {
      setShowCustomAnswersWarning(false)
    }
  }, [allowsCustomAnswers, customAnswersCount])

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

    if (!question) {
      setError("No question to update")
      setIsSubmitting(false)
      return
    }

    // Validation
    if (options.filter((o) => o.trim()).length < 2) {
      setError("At least 2 options are required")
      setIsSubmitting(false)
      return
    }

    try {
      // Prepare updates object
      const updates: any = {
        question: questionText,
        options: options.filter((o) => o.trim()),
        allows_custom_answers: allowsCustomAnswers,
        no_correct_answer: hasNoCorrectAnswer,
      }

      // Only set correct_answer if we have a valid option and no_correct_answer is false
      if (!hasNoCorrectAnswer && correctAnswer >= 0 && correctAnswer < options.length) {
        updates.correct_answer = options[correctAnswer]
      }

      const result = await updateQuestion(question.id, updates)

      if (result.success) {
        setSuccess(true)
        // Wait a moment before closing to show success message
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        setError(result.error || "Failed to update question")
      }
    } catch (error) {
      console.error("Error updating question:", error)
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!question) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-arcane-navy border border-arcane-blue/30 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-arcane-blue/30 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-arcane-gray-light">Edit Question</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label htmlFor="question" className="text-arcane-gray-light">
              Question
            </Label>
            <Textarea
              id="question"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="mt-1 border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue"
              required
            />
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
              checked={allowsCustomAnswers}
              onCheckedChange={setAllowsCustomAnswers}
              className="data-[state=checked]:bg-arcane-blue"
            />
          </div>

          {showCustomAnswersWarning && (
            <Alert variant="destructive" className="bg-red-900/20 border-red-500/50 text-red-400">
              <AlertDescription>
                Warning: Disabling custom answers will delete {customAnswersCount} existing custom answer
                {customAnswersCount !== 1 ? "s" : ""} for this question.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center space-x-2 mb-2">
            <Checkbox
              id="no-correct-answer"
              checked={hasNoCorrectAnswer}
              onCheckedChange={(checked) => setHasNoCorrectAnswer(checked === true)}
              className="data-[state=checked]:bg-arcane-blue data-[state=checked]:border-arcane-blue"
            />
            <Label htmlFor="no-correct-answer" className="text-arcane-gray-light">
              No correct answer (opinion question)
            </Label>
          </div>

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
              {/* Only show radio buttons if there is a correct answer */}
              {!hasNoCorrectAnswer ? (
                <RadioGroup
                  value={correctAnswer.toString()}
                  onValueChange={(value) => setCorrectAnswer(Number.parseInt(value))}
                >
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <RadioGroupItem value={index.toString()} id={`correct-${index}`} className="text-arcane-blue" />
                      <Input
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue"
                      />
                      {options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(index)}
                          className="h-8 w-8 text-arcane-gray"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                // When "No correct answer" is checked, show options without radio buttons
                <>
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-5"></div> {/* Spacer to align with radio buttons */}
                      <Input
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue"
                      />
                      {options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(index)}
                          className="h-8 w-8 text-arcane-gray"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {hasNoCorrectAnswer && (
            <div className="rounded-md border border-arcane-blue/30 bg-arcane-navy/20 p-4 text-arcane-gray-light">
              <p className="text-center">
                This question has no correct answer. All options will be treated as opinion-based responses.
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="bg-red-900/20 border-red-500/50 text-red-400">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert variant="default" className="bg-green-900/20 text-green-400 border-green-500/50">
              <AlertDescription>Question updated successfully!</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-arcane-gray text-arcane-gray hover:bg-arcane-gray/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update Question"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
