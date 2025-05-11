"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PlusCircle, X, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"

interface QuestionFormProps {
  onSubmit: (formData: FormData) => Promise<{ success: boolean; error?: string; gameId?: string }>
}

export default function QuestionForm({ onSubmit }: QuestionFormProps) {
  const [questionType, setQuestionType] = useState<"baby-picture" | "text">("baby-picture")
  const [options, setOptions] = useState<string[]>(["", "", "", ""])
  const [correctAnswer, setCorrectAnswer] = useState<number>(0)
  const [hasNoCorrectAnswer, setHasNoCorrectAnswer] = useState(false)
  const [allowsCustomAnswers, setAllowsCustomAnswers] = useState(true)
  const [noPrefilledOptions, setNoPrefilledOptions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [games, setGames] = useState<any[]>([])
  const [activeGameId, setActiveGameId] = useState<string>("")
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  // Add a function to log debug information
  const addDebugLog = (message: string) => {
    console.log(`[DEBUG] ${message}`)
    setDebugInfo((prev) => [...prev, message])
  }

  useEffect(() => {
    // Fetch games for the dropdown
    const fetchGames = async () => {
      try {
        addDebugLog("Fetching games...")
        const response = await fetch("/api/games")
        if (response.ok) {
          const data = await response.json()
          setGames(data.games || [])
          addDebugLog(`Fetched ${data.games?.length || 0} games`)

          // Find the active game
          const activeGame = data.games?.find((game: any) => game.is_active)
          if (activeGame) {
            setActiveGameId(activeGame.id)
            addDebugLog(`Active game found: ${activeGame.name} (${activeGame.id})`)
          } else {
            addDebugLog("No active game found")
          }
        } else {
          addDebugLog(`Error fetching games: ${response.status} ${response.statusText}`)
        }
      } catch (error) {
        console.error("Error fetching games:", error)
        addDebugLog(`Error fetching games: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    fetchGames()
  }, [])

  // If custom answers are disabled, we can't have no prefilled options
  useEffect(() => {
    if (!allowsCustomAnswers && noPrefilledOptions) {
      setNoPrefilledOptions(false)
      addDebugLog("Disabled 'No prefilled options' because custom answers are disabled")
    }
  }, [allowsCustomAnswers, noPrefilledOptions])

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const addOption = () => {
    setOptions([...options, ""])
    addDebugLog("Added new option")
  }

  const removeOption = (index: number) => {
    if (options.length <= 2 && !noPrefilledOptions) return

    const newOptions = options.filter((_, i) => i !== index)
    setOptions(newOptions)
    addDebugLog(`Removed option at index ${index}`)

    if (correctAnswer >= newOptions.length) {
      setCorrectAnswer(0)
      addDebugLog("Reset correct answer to index 0")
    } else if (correctAnswer > index) {
      setCorrectAnswer(correctAnswer - 1)
      addDebugLog(`Adjusted correct answer to index ${correctAnswer - 1}`)
    }
  }

  const clearAllOptions = () => {
    setOptions([])
    setCorrectAnswer(0)
    addDebugLog("Cleared all options")
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")
    setSuccess(false)
    setDebugInfo([])
    addDebugLog("Form submission started")
    addDebugLog(`Question type: ${questionType}`)
    addDebugLog(`Game ID: ${activeGameId}`)
    addDebugLog(`Has no correct answer: ${hasNoCorrectAnswer}`)
    addDebugLog(`Allows custom answers: ${allowsCustomAnswers}`)
    addDebugLog(`No prefilled options: ${noPrefilledOptions}`)
    addDebugLog(`Options count: ${options.length}`)
    addDebugLog(`Correct answer index: ${correctAnswer}`)
    // Add this after the other debug logs in handleSubmit
    addDebugLog(`Using no_correct_answer flag: ${hasNoCorrectAnswer || noPrefilledOptions}`)

    // Validation
    if (!noPrefilledOptions && options.filter((o) => o.trim()).length < 2) {
      const errorMsg = "At least 2 options are required unless 'No prefilled options' is enabled"
      setError(errorMsg)
      addDebugLog(`Validation error: ${errorMsg}`)
      setIsSubmitting(false)
      return
    }

    if (noPrefilledOptions && !allowsCustomAnswers) {
      const errorMsg = "Custom answers must be enabled when using 'No prefilled options'"
      setError(errorMsg)
      addDebugLog(`Validation error: ${errorMsg}`)
      setIsSubmitting(false)
      return
    }

    const form = e.currentTarget
    const formData = new FormData(form)

    // Check if image is present for baby picture questions
    if (questionType === "baby-picture") {
      const imageFile = formData.get("image") as File
      addDebugLog(`Image file: ${imageFile ? imageFile.name : "none"}`)
      addDebugLog(`Image file size: ${imageFile ? imageFile.size : 0} bytes`)
      addDebugLog(`Image file type: ${imageFile ? imageFile.type : "none"}`)

      if (!imageFile || imageFile.size === 0) {
        const errorMsg = "Image is required for baby picture questions"
        setError(errorMsg)
        addDebugLog(`Validation error: ${errorMsg}`)
        setIsSubmitting(false)
        return
      }
    }

    // Explicitly add the question type to the form data
    formData.append("type", questionType)
    addDebugLog(`Added question type to form data: ${questionType}`)

    // Add options to form data (regardless of whether there's a correct answer)
    if (!noPrefilledOptions) {
      let validOptionsCount = 0
      options.forEach((option, index) => {
        if (option.trim()) {
          formData.append(`option_${index}`, option)
          validOptionsCount++
          addDebugLog(`Added option ${index}: "${option}"`)
        }
      })
      addDebugLog(`Total valid options added: ${validOptionsCount}`)
    }

    // Handle the case of no prefilled options
    formData.append("no_prefilled_options", noPrefilledOptions ? "true" : "false")
    addDebugLog(`Added no_prefilled_options: ${noPrefilledOptions}`)

    // Handle the case of no correct answer
    if (hasNoCorrectAnswer || noPrefilledOptions) {
      formData.append("no_correct_answer", "true")
      formData.append("correctAnswerIndex", "-1")
      addDebugLog("Added no_correct_answer: true")
    } else {
      formData.append("correctAnswerIndex", correctAnswer.toString())
      addDebugLog(`Added correctAnswerIndex: ${correctAnswer}`)
      addDebugLog(`Correct answer text: "${options[correctAnswer]}"`)
    }

    try {
      addDebugLog("Submitting form data to server...")
      const result = await onSubmit(formData)
      addDebugLog(`Server response: ${JSON.stringify(result)}`)

      if (result.success) {
        addDebugLog("Question added successfully!")
        setSuccess(true)
        form.reset()
        setOptions(["", "", "", ""])
        setCorrectAnswer(0)
        setHasNoCorrectAnswer(false)
        setNoPrefilledOptions(false)
        setQuestionType("baby-picture")
        setAllowsCustomAnswers(true)
      } else {
        const errorMsg = result.error || "Failed to add question"
        setError(errorMsg)
        addDebugLog(`Error from server: ${errorMsg}`)
      }
    } catch (error) {
      console.error("Error submitting question:", error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      addDebugLog(`Exception during submission: ${errorMsg}`)
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
      addDebugLog("Form submission completed")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="game-id" className="text-arcane-gray-light">
          Game
        </Label>
        <select
          id="game-id"
          name="game_id"
          className="w-full rounded-md border border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue p-2"
          required
          value={activeGameId}
          onChange={(e) => {
            setActiveGameId(e.target.value)
            addDebugLog(`Selected game changed to: ${e.target.value}`)
          }}
        >
          <option value="">Select a game</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name} {game.is_active ? "(Active)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="question-type" className="text-arcane-gray-light">
            Question Type
          </Label>
          <RadioGroup
            value={questionType}
            onValueChange={(value) => {
              setQuestionType(value as "baby-picture" | "text")
              addDebugLog(`Question type changed to: ${value}`)
            }}
            className="mt-2 flex space-x-4"
            name="question-type"
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
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  addDebugLog(`Image selected: ${file.name}, size: ${file.size} bytes, type: ${file.type}`)
                } else {
                  addDebugLog("No image selected")
                }
              }}
            />
            <p className="mt-1 text-xs text-arcane-gray">Supported formats: JPG, PNG, GIF.</p>
          </div>
        )}

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
            checked={allowsCustomAnswers}
            onCheckedChange={(checked) => {
              setAllowsCustomAnswers(checked)
              addDebugLog(`Allow custom answers changed to: ${checked}`)
            }}
            className="data-[state=checked]:bg-arcane-blue"
          />
        </div>

        <div className="flex items-center space-x-2 mb-2">
          <Checkbox
            id="no-prefilled-options"
            checked={noPrefilledOptions}
            onCheckedChange={(checked) => {
              const isChecked = checked === true
              setNoPrefilledOptions(isChecked)
              addDebugLog(`No prefilled options changed to: ${isChecked}`)
              if (isChecked) {
                // If enabling no prefilled options, ensure custom answers are enabled
                setAllowsCustomAnswers(true)
                addDebugLog("Enabled custom answers because no prefilled options was enabled")
                // Also ensure no correct answer is selected
                setHasNoCorrectAnswer(true)
                addDebugLog("Enabled no correct answer because no prefilled options was enabled")
              }
            }}
            className="data-[state=checked]:bg-arcane-blue data-[state=checked]:border-arcane-blue"
            disabled={!allowsCustomAnswers}
          />
          <Label
            htmlFor="no-prefilled-options"
            className={`${!allowsCustomAnswers ? "text-arcane-gray" : "text-arcane-gray-light"}`}
          >
            No prefilled options (all answers will be submitted by guests)
          </Label>
        </div>

        {!noPrefilledOptions && (
          <div className="flex items-center space-x-2 mb-2">
            <Checkbox
              id="no-correct-answer"
              checked={hasNoCorrectAnswer}
              onCheckedChange={(checked) => {
                setHasNoCorrectAnswer(checked === true)
                addDebugLog(`No correct answer changed to: ${checked}`)
              }}
              className="data-[state=checked]:bg-arcane-blue data-[state=checked]:border-arcane-blue"
            />
            <Label htmlFor="no-correct-answer" className="text-arcane-gray-light">
              No correct answer (opinion question)
            </Label>
          </div>
        )}

        {!noPrefilledOptions && (
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-arcane-gray-light">Answer Options</Label>
              <div className="flex space-x-2">
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
                {options.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearAllOptions}
                    className="h-8 text-xs border-red-500 text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-2 space-y-3">
              {/* Only show radio buttons if there is a correct answer */}
              {!hasNoCorrectAnswer ? (
                <RadioGroup
                  value={correctAnswer.toString()}
                  onValueChange={(value) => {
                    setCorrectAnswer(Number.parseInt(value))
                    addDebugLog(`Correct answer changed to index: ${value}`)
                  }}
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
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                        className="h-8 w-8 text-arcane-gray"
                      >
                        <X className="h-4 w-4" />
                      </Button>
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                        className="h-8 w-8 text-arcane-gray"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </>
              )}

              {options.length === 0 && (
                <div className="text-center py-4 text-arcane-gray italic">
                  No options added. Click "Add Option" to add answer choices.
                </div>
              )}
            </div>
          </div>
        )}

        {hasNoCorrectAnswer && !noPrefilledOptions && (
          <div className="rounded-md border border-arcane-blue/30 bg-arcane-navy/20 p-4 text-arcane-gray-light">
            <p className="text-center">
              This question has no correct answer. All options will be treated as opinion-based responses.
            </p>
          </div>
        )}

        {noPrefilledOptions && (
          <div className="rounded-md border border-arcane-blue/30 bg-arcane-navy/20 p-4 text-arcane-gray-light">
            <p className="text-center">All answer options will be submitted by guests during the game.</p>
          </div>
        )}
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

      {/* Debug information section */}
      {debugInfo.length > 0 && (
        <div className="mt-4 p-4 bg-gray-900 rounded-md overflow-auto max-h-60">
          <h3 className="text-white font-bold mb-2">Debug Information:</h3>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap">
            {debugInfo.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </pre>
        </div>
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
