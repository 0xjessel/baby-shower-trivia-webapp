"use client"

import type React from "react"
import { useGameState } from "@/hooks/use-game-state"
import { useGamePusher } from "@/hooks/use-game-pusher"
import QuestionDisplay from "@/components/question-display"
import LoadingScreen from "@/components/loading-screen"
import WaitingScreen from "@/components/waiting-screen"

export default function GamePage() {
  const gameState = useGameState()

  // Set up Pusher event handling
  useGamePusher(gameState)

  // Handle custom answer input change
  const handleCustomAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    gameState.setNewCustomAnswer(e.target.value)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 relative">
      {gameState.isLoading && !gameState.bypassLoading ? (
        <LoadingScreen />
      ) : gameState.isWaiting ? (
        <WaitingScreen playerName={gameState.playerName} />
      ) : gameState.currentQuestion ? (
        <QuestionDisplay
          question={gameState.currentQuestion}
          selectedAnswer={gameState.selectedAnswer}
          submittedAnswer={gameState.submittedAnswer}
          hasSubmitted={gameState.hasSubmitted}
          timeIsUp={gameState.timeIsUp}
          timerActive={gameState.timerActive}
          timerReset={gameState.timerReset}
          voteCounts={gameState.voteCounts}
          totalVotes={gameState.totalVotes}
          customAnswers={gameState.customAnswers}
          isSubmittingAnswer={gameState.isSubmittingAnswer}
          onAnswerChange={gameState.handleAnswerChange}
          onTimeUp={gameState.handleTimeUp}
          // Custom answer props
          newCustomAnswer={gameState.newCustomAnswer}
          isSubmittingCustom={gameState.isSubmittingCustom}
          onCustomAnswerChange={handleCustomAnswerChange}
          onCustomAnswerKeyDown={gameState.handleCustomAnswerKeyDown}
          onAddCustomAnswer={gameState.handleAddCustomAnswer}
        />
      ) : null}
    </main>
  )
}
