"use client"

import type React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Users } from "lucide-react"
import CountdownTimer from "@/components/countdown-timer"
import CustomAnswerInput from "@/components/custom-answer-input"
import { LoadingSpinner } from "@/components/loading-spinner"
import type { Question, CustomAnswer, VoteCounts } from "@/types/game"

interface QuestionDisplayProps {
  question: Question
  selectedAnswer: string
  submittedAnswer: string
  hasSubmitted: boolean
  timeIsUp: boolean
  timerActive: boolean
  timerReset: number
  voteCounts: VoteCounts
  totalVotes: number
  customAnswers: CustomAnswer[]
  isSubmittingAnswer: boolean
  isLoadingQuestion: boolean
  onAnswerChange: (value: string) => void
  onTimeUp: () => void
  // Custom answer props
  newCustomAnswer: string
  isSubmittingCustom: boolean
  hasAddedCustomAnswer: boolean
  onCustomAnswerChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onCustomAnswerKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onAddCustomAnswer: (e: React.MouseEvent) => void
}

export default function QuestionDisplay({
  question,
  selectedAnswer,
  submittedAnswer,
  hasSubmitted,
  timeIsUp,
  timerActive,
  timerReset,
  voteCounts,
  totalVotes,
  customAnswers,
  isSubmittingAnswer,
  isLoadingQuestion,
  onAnswerChange,
  onTimeUp,
  // Custom answer props
  newCustomAnswer,
  isSubmittingCustom,
  hasAddedCustomAnswer,
  onCustomAnswerChange,
  onCustomAnswerKeyDown,
  onAddCustomAnswer,
}: QuestionDisplayProps) {
  // Keep predefined options and custom answers separate
  const allOptions = question.options
  const customAnswerOptions = customAnswers.map((ca) => ca.text)

  // Check if the current user has added a custom answer for this question
  const userAddedCustomAnswer = hasAddedCustomAnswer

  // Determine if this is an opinion question (no timer needed)
  const isOpinionQuestion = question.isOpinionQuestion === true

  // If loading a new question, show spinner
  if (isLoadingQuestion) {
    return (
      <Card className="w-full max-w-md border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
        <CardContent className="p-6 flex flex-col items-center justify-center min-h-[300px]">
          <LoadingSpinner size="lg" message="Loading next question..." />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold text-arcane-blue flex-1">{question.question}</h2>
          {/* Only show timer for non-opinion questions */}
          {!isOpinionQuestion && (
            <div className="ml-4 flex-shrink-0">
              <CountdownTimer duration={30} onTimeUp={onTimeUp} isActive={timerActive} reset={timerReset} />
            </div>
          )}
        </div>

        {question.type === "baby-picture" && question.imageUrl && (
          <div className="mb-6 overflow-hidden rounded-lg">
            <img
              src={question.imageUrl || "/placeholder.svg"}
              alt="Baby Picture"
              className="h-auto w-full object-cover"
            />
          </div>
        )}

        <div className="mb-6">
          {/* Main answer options */}
          <RadioGroup
            value={selectedAnswer}
            onValueChange={onAnswerChange}
            className="space-y-3"
            disabled={timeIsUp || isSubmittingAnswer}
          >
            {/* Predefined options */}
            {allOptions.map((option, index) => {
              const voteCount = voteCounts[option] || 0
              const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0

              return (
                <div
                  key={`predefined-${index}`}
                  className={`relative flex items-center rounded-lg border p-3 transition-colors overflow-hidden ${
                    selectedAnswer === option
                      ? "border-arcane-blue bg-arcane-blue/10"
                      : "border-arcane-blue/20 bg-arcane-navy/50"
                  } ${timeIsUp ? "opacity-70" : ""} cursor-pointer`}
                  onClick={() => !timeIsUp && !isSubmittingAnswer && onAnswerChange(option)}
                >
                  {/* Background progress bar */}
                  <div className="absolute inset-0 bg-arcane-gold/10 z-0" style={{ width: `${percentage}%` }} />

                  <RadioGroupItem value={option} id={`option-${index}`} className="text-arcane-blue z-10" />
                  <div className="ml-2 w-full z-10">
                    <Label htmlFor={`option-${index}`} className="text-arcane-gray-light cursor-pointer">
                      {option}
                    </Label>
                  </div>

                  {/* Vote count indicator */}
                  <div className="flex items-center text-xs text-arcane-gold ml-2 z-10">
                    <Users className="h-3 w-3 mr-1" />
                    <span>{voteCount}</span>
                  </div>
                </div>
              )
            })}

            {/* Custom answers added by users */}
            {customAnswers.map((customAnswer, index) => {
              const option = customAnswer.text
              const voteCount = voteCounts[option] || 0
              const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0

              return (
                <div
                  key={`custom-${index}`}
                  className={`relative flex items-center rounded-lg border p-3 transition-colors overflow-hidden ${
                    selectedAnswer === option
                      ? "border-arcane-blue bg-arcane-blue/10"
                      : "border-arcane-blue/20 bg-arcane-navy/50"
                  } ${timeIsUp ? "opacity-70" : ""} cursor-pointer`}
                  onClick={() => !timeIsUp && !isSubmittingAnswer && onAnswerChange(option)}
                >
                  {/* Background progress bar */}
                  <div className="absolute inset-0 bg-arcane-gold/10 z-0" style={{ width: `${percentage}%` }} />

                  <RadioGroupItem value={option} id={`custom-option-${index}`} className="text-arcane-blue z-10" />
                  <div className="ml-2 w-full z-10">
                    <Label htmlFor={`custom-option-${index}`} className="text-arcane-gray-light cursor-pointer">
                      {option}
                    </Label>
                    <p className="text-xs text-arcane-gold mt-0.5">Added by {customAnswer.addedBy}</p>
                  </div>

                  {/* Vote count indicator */}
                  <div className="flex items-center text-xs text-arcane-gold ml-2 z-10">
                    <Users className="h-3 w-3 mr-1" />
                    <span>{voteCount}</span>
                  </div>
                </div>
              )
            })}
          </RadioGroup>

          {/* Custom answer input - only show if the user hasn't added a custom answer yet */}
          {question.allowsCustomAnswers && !userAddedCustomAnswer && (
            <CustomAnswerInput
              newCustomAnswer={newCustomAnswer}
              isSubmittingCustom={isSubmittingCustom}
              timeIsUp={timeIsUp}
              onCustomAnswerChange={onCustomAnswerChange}
              onCustomAnswerKeyDown={onCustomAnswerKeyDown}
              onAddCustomAnswer={onAddCustomAnswer}
            />
          )}

          {totalVotes > 0 && (
            <div className="mt-2 text-xs text-arcane-gray flex items-center justify-end">
              <Users className="h-3 w-3 mr-1" />
              <span>Total votes: {totalVotes}</span>
            </div>
          )}
        </div>

        {/* Status message */}
        {selectedAnswer && hasSubmitted ? (
          <div className="w-full text-center py-2 text-green-400">
            Answer submitted! {isSubmittingAnswer && "Processing..."}
          </div>
        ) : timeIsUp && !isOpinionQuestion ? (
          <div className="w-full text-center py-2 text-arcane-gray">Time's up! Waiting for the next question...</div>
        ) : !selectedAnswer ? (
          <div className="w-full text-center py-2 text-arcane-gray">Select an answer to submit</div>
        ) : (
          <div className="w-full text-center py-2"></div> // Empty div to maintain spacing
        )}
      </CardContent>
    </Card>
  )
}
