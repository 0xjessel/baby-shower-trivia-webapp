"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Participant {
  name: string
  score: number
  totalAnswered: number
}

interface QuestionStat {
  id: string
  question: string
  totalAnswers: number
  correctAnswers: number
}

export default function GameStats() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/game-stats")
      const data = await response.json()

      if (data.participants && data.questionStats) {
        setParticipants(data.participants)
        setQuestionStats(data.questionStats)
      }
    } catch (err) {
      console.error("Error fetching game stats:", err)
      setError("Failed to load game statistics")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-arcane-blue/30 border-t-arcane-blue mx-auto"></div>
        <p className="text-arcane-gray">Loading game statistics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-900/20 p-4 text-center text-red-400 border border-red-500/50">
        {error}
        <Button
          onClick={fetchStats}
          variant="outline"
          size="sm"
          className="mt-2 border-arcane-blue text-arcane-blue hover:bg-arcane-blue/10"
        >
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-lg font-medium text-arcane-blue">Participant Scores</h3>
        {participants.length === 0 ? (
          <p className="text-arcane-gray">No participants have joined yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {participants
              .sort((a, b) => b.score - a.score)
              .map((participant, index) => (
                <Card key={index} className="border border-arcane-blue/30 bg-arcane-navy/80">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-arcane-gray-light">{participant.name}</p>
                        <p className="text-sm text-arcane-gray">Answered {participant.totalAnswered} questions</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-arcane-gold">{participant.score}</p>
                        <p className="text-xs text-arcane-gray">points</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium text-arcane-blue">Question Statistics</h3>
        {questionStats.length === 0 ? (
          <p className="text-arcane-gray">No questions have been answered yet.</p>
        ) : (
          <div className="space-y-3">
            {questionStats.map((stat, index) => (
              <Card key={index} className="border border-arcane-blue/30 bg-arcane-navy/80">
                <CardContent className="p-4">
                  <p className="font-medium text-arcane-gray-light">{stat.question}</p>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-arcane-gray">Correct answers:</span>
                      <span className="font-medium text-green-400">
                        {stat.correctAnswers} / {stat.totalAnswers}
                        {stat.totalAnswers > 0 && ` (${Math.round((stat.correctAnswers / stat.totalAnswers) * 100)}%)`}
                      </span>
                    </div>
                    {stat.totalAnswers > 0 && (
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-arcane-navy">
                        <div
                          className="h-full bg-arcane-blue"
                          style={{ width: `${(stat.correctAnswers / stat.totalAnswers) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
