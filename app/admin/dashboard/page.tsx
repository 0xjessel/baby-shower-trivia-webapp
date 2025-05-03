"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { nextQuestion, showResults, resetGame, uploadQuestion } from "@/app/actions"
import QuestionForm from "@/components/question-form"
import QuestionList from "@/components/question-list"
import GameStats from "@/components/game-stats"

export default function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
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
    try {
      await nextQuestion()
    } catch (error) {
      console.error("Failed to advance to next question:", error)
    }
  }

  const handleShowResults = async () => {
    try {
      await showResults()
    } catch (error) {
      console.error("Failed to show results:", error)
    }
  }

  const handleResetGame = async () => {
    if (window.confirm("Are you sure you want to reset the game? This will clear all questions and results.")) {
      try {
        await resetGame()
      } catch (error) {
        console.error("Failed to reset game:", error)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-pink-50 to-blue-50">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600 mx-auto"></div>
          <p className="text-lg text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-blue-50 p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-pink-600">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage your baby shower trivia game</p>
        </div>

        <div className="grid gap-6">
          <Card className="border-2 border-pink-200 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl text-pink-600">Game Controls</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={handleNextQuestion} className="bg-pink-600 hover:bg-pink-700">
                Next Question
              </Button>
              <Button
                onClick={handleShowResults}
                variant="outline"
                className="border-pink-600 text-pink-600 hover:bg-pink-50"
              >
                Show Results
              </Button>
              <Button onClick={handleResetGame} variant="destructive" className="ml-auto">
                Reset Game
              </Button>
            </CardContent>
          </Card>

          <Tabs defaultValue="questions" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="questions">Questions</TabsTrigger>
              <TabsTrigger value="add">Add Question</TabsTrigger>
              <TabsTrigger value="stats">Game Stats</TabsTrigger>
            </TabsList>

            <TabsContent value="questions">
              <Card className="border-2 border-pink-200 shadow-md">
                <CardContent className="pt-6">
                  <QuestionList />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="add">
              <Card className="border-2 border-pink-200 shadow-md">
                <CardContent className="pt-6">
                  <QuestionForm onSubmit={uploadQuestion} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
              <Card className="border-2 border-pink-200 shadow-md">
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
