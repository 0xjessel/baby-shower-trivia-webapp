"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"
import type React from "react"

interface CustomAnswerInputProps {
  newCustomAnswer: string
  isSubmittingCustom: boolean
  timeIsUp: boolean
  onCustomAnswerChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onCustomAnswerKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onAddCustomAnswer: (e: React.MouseEvent) => void
}

export default function CustomAnswerInput({
  newCustomAnswer,
  isSubmittingCustom,
  timeIsUp,
  onCustomAnswerChange,
  onCustomAnswerKeyDown,
  onAddCustomAnswer,
}: CustomAnswerInputProps) {
  return (
    <div className="relative flex items-center rounded-lg border border-arcane-blue/20 bg-arcane-navy/50 p-3 transition-colors mt-3">
      <div className="flex w-full items-center gap-2 z-10">
        <Input
          placeholder="Add your own answer..."
          value={newCustomAnswer}
          onChange={onCustomAnswerChange}
          onKeyDown={onCustomAnswerKeyDown}
          className="border-none bg-transparent text-arcane-gray-light focus:ring-0 pl-2 h-auto"
          disabled={isSubmittingCustom || timeIsUp}
        />
        <Button
          onClick={onAddCustomAnswer}
          disabled={!newCustomAnswer.trim() || isSubmittingCustom || timeIsUp}
          className="bg-arcane-gold hover:bg-arcane-gold/80 text-arcane-navy h-8 w-8 p-0 rounded-full"
          size="icon"
          type="button"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
