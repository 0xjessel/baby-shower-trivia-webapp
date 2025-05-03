"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { nextQuestion, showResults, resetGame, uploadQuestion } from "@/app/actions"
import { toast } from "@/hooks/use-toast"
import QuestionForm from "@/components/question-form"
import QuestionList from "@/components/question-list"
import GameStats from "@/components/game-stats"

export default function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionInProgress, setIsActionInProgress] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated as admin
    fetch("/api/check-admin")
      .then((res) => res.json())
      .then((data) => {
        if (!data.isAdmin) {
          router.push("/admin")
        } else {
          setIsAdmin(true)
        }
        setIsLoading(false)
      })
      .catch((err) => {
        console.error("Error checking admin status:", err)
        router.push("/admin")
      })
  }, [router])

  const handleNextQuestion = async () => {
    if (isActionInProgress) return

    setIsActionInProgress(true)
    try {
      const result = await nextQuestion()
      if (result.success) {
        toast({
          title: "Success",
          description: "Advanced to the next question",
        })
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
        </div>

        <div className="grid gap-6">
          <Card className="border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl text-arcane-blue">Game Controls</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                onClick={handleNextQuestion}
                className="bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold"
                disabled={isActionInProgress}
              >
                {isActionInProgress ? "Processing..." : "Next Question"}
              </Button>
              <Button
                onClick={handleShowResults}
                variant="outline"
                className="border-arcane-gold text-arcane-gold hover:bg-arcane-gold/10 font-medium"
                disabled={isActionInProgress}
              >
                {isActionInProgress ? "Processing..." : "Show Results"}
              </Button>
              <Button onClick={handleResetGame} variant="destructive" className="ml-auto" disabled={isActionInProgress}>
                {isActionInProgress ? "Processing..." : "Reset Game"}
              </Button>
            </CardContent>
          </Card>

          <Tabs defaultValue="questions" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-arcane-navy border border-arcane-blue/30">
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
            </TabsList>

            <TabsContent value="questions">
              <Card className="border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
                <CardContent className="pt-6">
                  <QuestionList />
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
          </Tabs>
        </div>
      </div>
    </div>
  )
}
