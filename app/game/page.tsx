"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useGameState } from "@/hooks/use-game-state"
import QuestionDisplay from "@/components/question-display"
import WaitingScreen from "@/components/waiting-screen"
import PlayerHeartbeat from "@/components/player-heartbeat"
import PusherStatus from "@/components/pusher-status"

export default function GamePage() {
  const router = useRouter()
  const {
    currentQuestion,
    selectedAnswer,
    submittedAnswer,
    hasSubmitted,
    isWaiting,
    timerActive,
    timerReset,
    timeIsUp,
    voteCounts,
    totalVotes,
    playerName,
    customAnswers,
    newCustomAnswer,
    isSubmittingAnswer,
    isSubmittingCustom,
    hasAddedCustomAnswer,
    isLoadingQuestion,
    handleAnswerChange,
    handleTimeUp,
    handleAddCustomAnswer,
    handleCustomAnswerKeyDown,
    setNewCustomAnswer,
  } = useGameState()

  // Handle custom answer input change
  const handleCustomAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCustomAnswer(e.target.value)
  }

  // Check if user is authenticated
  useEffect(() => {
    const name = localStorage.getItem("playerName")
    if (!name) {
      router.push("/join")
    }
  }, [router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-arcane-navy">
      <div className="w-full max-w-md">
        {isWaiting ? (
          <WaitingScreen playerName={playerName} />
        ) : (
          currentQuestion && (
            <QuestionDisplay
              question={currentQuestion}
              selectedAnswer={selectedAnswer}
              submittedAnswer={submittedAnswer}
              hasSubmitted={hasSubmitted}
              timeIsUp={timeIsUp}
              timerActive={timerActive}
              timerReset={timerReset}
              voteCounts={voteCounts}
              totalVotes={totalVotes}
              customAnswers={customAnswers}
              isSubmittingAnswer={isSubmittingAnswer}
              isLoadingQuestion={isLoadingQuestion}
              onAnswerChange={handleAnswerChange}
              onTimeUp={handleTimeUp}
              newCustomAnswer={newCustomAnswer}
              isSubmittingCustom={isSubmittingCustom}
              hasAddedCustomAnswer={hasAddedCustomAnswer}
              onCustomAnswerChange={handleCustomAnswerChange}
              onCustomAnswerKeyDown={handleCustomAnswerKeyDown}
              onAddCustomAnswer={handleAddCustomAnswer}
            />
          )
        )}
      </div>

      {/* Player heartbeat to track online status */}
      <PlayerHeartbeat />

      {/* Pusher connection status indicator */}
      <div className="fixed bottom-2 right-2">
        <PusherStatus />
      </div>
    </main>
  )
}
