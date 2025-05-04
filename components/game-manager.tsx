"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { createGame, setActiveGame, deleteGame } from "@/app/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CheckCircle, Trash2, PlusCircle } from "lucide-react"

interface Game {
  id: string
  name: string
  description: string
  created_at: string
  is_active: boolean
}

export default function GameManager() {
  const [games, setGames] = useState<Game[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [newGameName, setNewGameName] = useState("")
  const [newGameDescription, setNewGameDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [gameToDelete, setGameToDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchGames()
  }, [])

  const fetchGames = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/games", {
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setGames(data.games || [])
    } catch (err) {
      console.error("Error fetching games:", err)
      setError("Failed to load games")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGameName.trim()) return

    setIsCreating(true)
    try {
      const result = await createGame({
        name: newGameName.trim(),
        description: newGameDescription.trim(),
      })

      if (result.success) {
        toast({
          title: "Game created",
          description: `"${newGameName}" has been created successfully.`,
        })
        setNewGameName("")
        setNewGameDescription("")
        setShowCreateForm(false)
        fetchGames()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create game",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating game:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleSetActive = async (gameId: string) => {
    try {
      const result = await setActiveGame(gameId)

      if (result.success) {
        toast({
          title: "Game activated",
          description: "The selected game is now active for all players.",
        })
        fetchGames()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to activate game",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error setting active game:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const confirmDelete = (gameId: string) => {
    setGameToDelete(gameId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!gameToDelete) return

    try {
      const result = await deleteGame(gameToDelete)

      if (result.success) {
        toast({
          title: "Game deleted",
          description: "The game has been deleted successfully.",
        })
        fetchGames()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete game",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting game:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setGameToDelete(null)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-arcane-blue/30 border-t-arcane-blue mx-auto"></div>
        <p className="text-arcane-gray">Loading games...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-900/20 p-4 text-center text-red-400 border border-red-500/50">
        {error}
        <Button
          onClick={fetchGames}
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
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-arcane-blue">Game Management</h2>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          {showCreateForm ? "Cancel" : "Create New Game"}
        </Button>
      </div>

      {showCreateForm && (
        <Card className="border-2 border-arcane-blue/30 bg-arcane-navy/80 shadow-md">
          <CardContent className="pt-6">
            <form onSubmit={handleCreateGame} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="game-name" className="text-arcane-gray-light">
                  Game Name
                </Label>
                <Input
                  id="game-name"
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  placeholder="Enter game name"
                  className="border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="game-description" className="text-arcane-gray-light">
                  Description (Optional)
                </Label>
                <Textarea
                  id="game-description"
                  value={newGameDescription}
                  onChange={(e) => setNewGameDescription(e.target.value)}
                  placeholder="Enter game description"
                  className="border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue"
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold"
                disabled={isCreating || !newGameName.trim()}
              >
                {isCreating ? "Creating..." : "Create Game"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {games.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-arcane-gray">No games created yet. Create your first game to get started!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {games.map((game) => (
            <Card
              key={game.id}
              className={`border ${
                game.is_active ? "border-arcane-gold border-2" : "border-arcane-blue/30"
              } bg-arcane-navy/80 transition-all duration-200`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-arcane-gray-light">{game.name}</h3>
                      {game.is_active && (
                        <span className="inline-flex items-center rounded-full bg-arcane-gold/20 px-2 py-1 text-xs font-medium text-arcane-gold">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Active
                        </span>
                      )}
                    </div>
                    {game.description && <p className="mt-1 text-sm text-arcane-gray">{game.description}</p>}
                    <p className="mt-1 text-xs text-arcane-gray">
                      Created: {new Date(game.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {!game.is_active && (
                      <Button
                        onClick={() => handleSetActive(game.id)}
                        variant="outline"
                        size="sm"
                        className="border-arcane-gold text-arcane-gold hover:bg-arcane-gold/10"
                      >
                        Set Active
                      </Button>
                    )}
                    <Button
                      onClick={() => confirmDelete(game.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
                      disabled={game.is_active}
                      title={game.is_active ? "Cannot delete active game" : "Delete game"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-arcane-navy border-arcane-blue/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-arcane-blue">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-arcane-gray">
              Are you sure you want to delete this game? This action cannot be undone and will remove all questions and
              answers associated with this game.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-arcane-gray text-arcane-gray hover:bg-arcane-navy/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white border-none">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
