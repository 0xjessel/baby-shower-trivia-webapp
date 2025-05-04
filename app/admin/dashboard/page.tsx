"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { nextQuestion, previousQuestion, showResults, resetGame, resetVotes, uploadQuestion } from "@/app/actions"
import { toast } from "@/hooks/use-toast"
import QuestionForm from "@/components/question-form"
import QuestionList from "@/components/question-list"
import GameStats from "@/components/game-stats"
import GameManager from "@/components/game-manager"
import ActiveQuestionDisplay from "@/components/active-question-display"
import { Clock, ChevronLeft, ChevronRight, Trophy, Users } from "lucide-react"
import type { Question, CustomAnswer, VoteCounts } from "@/types/game"

export default function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionInProgress, setIsActionInProgress] = useState(false)
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [isLastQuestion, setIsLastQuestion] = useState(false)
  const router = useRouter()
  const [activePlayers, setActivePlayers] = useState(0)
  const [activeGameName, setActiveGameName] = useState<string>("Current Game")
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [customAnswers, setCustomAnswers] = useState<CustomAnswer[]>([])
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({})
  const [totalVotes, setTotalVotes] = useState(0)

  const lastFetchTimeRef = useRef(0)

  // Fetch current question data with debouncing
  const fetchCurrentQuestion = useCallback(async () => {
    // Avoid fetching too frequently
    if (Date.now() - lastFetchTimeRef.current < 2000) {
      return
    }

    try {
      lastFetchTimeRef.current = Date.now()
      const response = await fetch("/api/current-question", {
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.question) {
          setCurrentQuestion(data.question)
          setCustomAnswers(data.customAnswers || [])

          // Only fetch vote counts if we have a question
          if (data.question.id) {
            fetchVoteCounts(data.question.id)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching current question:", error)
    }
  }, [])

  // Fetch vote counts with debouncing
  const fetchVoteCounts = useCallback(async (questionId: string) => {
    // Avoid fetching too frequently
    if (Date.now() - lastFetchTimeRef.current < 1000) {
      return
    }

    try {
      lastFetchTimeRef.current = Date.now()
      const response = await fetch(`/api/vote-counts?questionId=${questionId}`, {
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setVoteCounts(data.voteCounts || {})
        setTotalVotes(data.totalVotes || 0)
      }
    } catch (error) {
      console.error("Error fetching vote counts:", error)
    }
  }, [])

  useEffect(() => {
    // Check if user is authenticated as admin
    fetch("/api/check-admin")
      .then((res) => res.json())
      .then((data) => {
        if (!data.isAdmin) {
          router.push("/admin")
        } else {
          setIsAdmin(true)
          fetchGameState()
          fetchQuestions()
          fetchActivePlayers() // Fetch active players initially
          fetchActiveGame() // Fetch active game name
          fetchCurrentQuestion() // Fetch current question data
        }
        setIsLoading(false)
      })
      .catch((err) => {
        console.error("Error checking admin status:", err)
        router.push("/admin")
      })

    // Set up interval to fetch active players
    const interval = setInterval(fetchActivePlayers, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [router, fetchCurrentQuestion])

  // Fetch active game name
  const fetchActiveGame = async () => {
    try {
      const response = await fetch("/api/active-game", {
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.game && data.game.name) {
          setActiveGameName(data.game.name)
        }
      }
    } catch (error) {
      console.error("Error fetching active game:", error)
    }
  }

  // Fetch current game state to get current question
  const fetchGameState = async () => {
    try {
      const response = await fetch("/api/game-state")
      const data = await response.json()

      if (data.currentQuestionId) {
        setCurrentQuestionId(data.currentQuestionId)
      }
    } catch (error) {
      console.error("Error fetching game state:", error)
    }
  }

  // Fetch questions to determine if we're on the last question
  const fetchQuestions = async () => {
    try {
      const response = await fetch("/api/questions")
      const data = await response.json()

      if (data.questions) {
        setQuestions(data.questions)

        // Check if current question is the last one
        if (currentQuestionId && data.questions.length > 0) {
          const currentIndex = data.questions.findIndex((q: any) => q.id === currentQuestionId)
          setIsLastQuestion(currentIndex === data.questions.length - 1)
        }
      }
    } catch (error) {
      console.error("Error fetching questions:", error)
    }
  }

  // Fetch active players count
  const fetchActivePlayers = async () => {
    try {
      const response = await fetch("/api/online-players", {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.count !== undefined) {
          setActivePlayers(data.count)
        }
      }
    } catch (error) {
      console.error("Error fetching active players:", error)
    }
  }

  // Update state after any question change
  useEffect(() => {
    if (questions.length > 0 && currentQuestionId) {
      const currentIndex = questions.findIndex((q) => q.id === currentQuestionId)
      setIsLastQuestion(currentIndex === questions.length - 1)
    }
  }, [questions, currentQuestionId])

  const handleNextQuestion = async () => {
    if (isActionInProgress) return

    setIsActionInProgress(true)
    try {
      const result = await nextQuestion()
      if (result.success) {
        toast({
          title: "Success",
          description: "Advanced to the next question. Players have 30 seconds to answer.",
        })
        // Refresh game state and questions
        await fetchGameState()
        await fetchQuestions()
        await fetchCurrentQuestion()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to advance to next question",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to advance to next question:", error)
      toast({
        title: "Error",
        description: "Failed to advance to next question. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsActionInProgress(false)
    }
  }

  const handlePreviousQuestion = async () => {
    if (isActionInProgress) return

    setIsActionInProgress(true)
    try {
      const result = await previousQuestion()
      if (result.success) {
        toast({
          title: "Success",
          description: "Went back to the previous question. Players have 30 seconds to answer.",
        })
        // Refresh game state and questions
        await fetchGameState()
        await fetchQuestions()
        await fetchCurrentQuestion()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to go back to previous question",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to go back to previous question:", error)
      toast({
        title: "Error",
        description: "Failed to go back to previous question. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsActionInProgress(false)
    }
  }

  const handleShowResults = async () => {
    if (isActionInProgress) return

    setIsActionInProgress(true)
    try {
      const result = await showResults()
      if (result.success) {
        toast({
          title: "Success",
          description: "Results are now visible to all participants",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to show results",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to show results:", error)
      toast({
        title: "Error",
        description: "Failed to show results. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsActionInProgress(false)
    }
  }

  const handleResetVotes = async () => {
    if (isActionInProgress) return

    if (window.confirm("Are you sure you want to reset all votes? This will clear all answers but keep questions.")) {
      setIsActionInProgress(true)
      try {
        const result = await resetVotes()
        if (result.success) {
          toast({
            title: "Success",
            description: "All votes have been reset",
          })
          // Refresh questions to update vote counts
          await fetchQuestions()
          await fetchCurrentQuestion()
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to reset votes",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Failed to reset votes:", error)
        toast({
          title: "Error",
          description: "Failed to reset votes. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsActionInProgress(false)
      }
    }
  }

  const handleResetGame = async () => {
    if (isActionInProgress) return

    if (window.confirm("Are you sure you want to reset the game? This will clear all questions and results.")) {
      setIsActionInProgress(true)
      try {
        const result = await resetGame()
        if (result.success) {
          toast({
            title: "Success",
            description: "Game has been reset",
          })
          setCurrentQuestionId(null)
          setIsLastQuestion(false)
          setCurrentQuestion(null)
          setCustomAnswers([])
          setVoteCounts({})
          setTotalVotes(0)
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to reset game",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Failed to reset game:", error)
        toast({
          title: "Error",
          description: "Failed to reset game. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsActionInProgress(false)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-arcane-navy">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-arcane-blue/30 border-t-arcane-blue mx-auto"></div>
          <p className="text-lg text-arcane-gray">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-arcane-navy p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-arcane-blue">Admin Dashboard</h1>
          <p className="mt-2 text-arcane-gray">Manage Baby Jayce's League Challenge</p>
          <p className="mt-1 text-arcane-gold font-medium">Active Game: {activeGameName}</p>
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card className="border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl text-arcane-blue">Game Controls</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  onClick={handlePreviousQuestion}
                  className="bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold flex items-center gap-2"
                  disabled={isActionInProgress || !currentQuestionId}
                >
                  {isActionInProgress ? (
                    "Processing..."
                  ) : (
                    <>
                      <ChevronLeft className="h-4 w-4" />
                      <span>Previous</span>
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleNextQuestion}
                  className="bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold flex items-center gap-2"
                  disabled={isActionInProgress || isLastQuestion}
                >
                  {isActionInProgress ? (
                    "Processing..."
                  ) : (
                    <>
                      <Clock className="h-4 w-4" />
                      <span>Next Question</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleShowResults}
                  variant="outline"
                  className="border-arcane-gold text-arcane-gold hover:bg-arcane-gold/20 hover:text-arcane-gold hover:border-arcane-gold font-medium flex items-center gap-2"
                  disabled={isActionInProgress}
                >
                  {isActionInProgress ? (
                    "Processing..."
                  ) : (
                    <>
                      <Trophy className="h-4 w-4" />
                      <span>Show Results</span>
                    </>
                  )}
                </Button>

                <div className="ml-auto flex gap-3">
                  <Button
                    onClick={handleResetVotes}
                    variant="outline"
                    className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
                    disabled={isActionInProgress}
                  >
                    {isActionInProgress ? "Processing..." : "Reset Votes"}
                  </Button>

                  <Button onClick={handleResetGame} variant="destructive" disabled={isActionInProgress}>
                    {isActionInProgress ? "Processing..." : "Reset Games"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-1">
            <div className="flex items-center mb-4 text-arcane-blue bg-arcane-navy/80 p-3 rounded-lg border-2 border-arcane-blue/50">
              <Users className="h-5 w-5 mr-2" />
              <span className="font-medium">{activePlayers} Active Players Online</span>
            </div>

            {/* Active Question Display with real-time updates */}
            <ActiveQuestionDisplay
              initialQuestion={currentQuestion}
              initialCustomAnswers={customAnswers}
              initialVoteCounts={voteCounts}
              initialTotalVotes={totalVotes}
            />
          </div>
        </div>

        <div className="mt-6">
          <Tabs defaultValue="questions" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-arcane-navy border border-arcane-blue/30">
              <TabsTrigger
                value="questions"
                className="data-[state=active]:bg-arcane-blue data-[state=active]:text-arcane-navy text-arcane-gray-light"
              >
                Questions
              </TabsTrigger>
              <TabsTrigger
                value="add"
                className="data-[state=active]:bg-arcane-blue data-[state=active]:text-arcane-navy text-arcane-gray-light"
              >
                Add Question
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="data-[state=active]:bg-arcane-blue data-[state=active]:text-arcane-navy text-arcane-gray-light"
              >
                Game Stats
              </TabsTrigger>
              <TabsTrigger
                value="games"
                className="data-[state=active]:bg-arcane-blue data-[state=active]:text-arcane-navy text-arcane-gray-light"
              >
                Games
              </TabsTrigger>
            </TabsList>

            <TabsContent value="questions">
              <Card className="border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
                <CardContent className="pt-6">
                  <QuestionList currentQuestionId={currentQuestionId} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="add">
              <Card className="border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
                <CardContent className="pt-6">
                  <QuestionForm onSubmit={uploadQuestion} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
              <Card className="border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
                <CardContent className="pt-6">
                  <GameStats />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="games">
              <Card className="border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
                <CardContent className="pt-6">
                  <GameManager />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
