"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { AlertTriangle, ArrowRight, Check } from "lucide-react"

export default function MigrationUI() {
  const [isLoading, setIsLoading] = useState(false)
  const [migrationComplete, setMigrationComplete] = useState(false)

  const handleMigration = async () => {
    if (
      !confirm(
        "Are you sure you want to migrate from the 'current' game to the active game system? This action cannot be undone.",
      )
    ) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/migrate-game-system", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Migration Successful",
          description: "The game system has been successfully migrated.",
        })
        setMigrationComplete(true)
      } else {
        toast({
          title: "Migration Failed",
          description: data.error || "An error occurred during migration.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Migration error:", error)
      toast({
        title: "Migration Failed",
        description: "An unexpected error occurred during migration.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-2 border-amber-500/50 bg-arcane-navy/80 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl text-amber-500 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Game System Migration
        </CardTitle>
        <CardDescription className="text-arcane-gray">
          Migrate from the legacy "current" game to the new active game system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-arcane-gray mb-4">
          This will transfer all questions and game state from the legacy "current" game to the active game system.
          After migration, the special "current" game will be removed, and all operations will use the active game.
        </p>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-amber-200 text-sm">
          <p className="font-medium mb-1">Important:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Make sure you have at least one game created and set as active</li>
            <li>This action cannot be undone</li>
            <li>All players should be notified before migration</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter>
        {migrationComplete ? (
          <div className="flex items-center gap-2 text-green-500">
            <Check className="h-5 w-5" />
            <span>Migration Complete</span>
          </div>
        ) : (
          <Button
            onClick={handleMigration}
            disabled={isLoading}
            className="bg-amber-500 hover:bg-amber-600 text-black flex items-center gap-2"
          >
            {isLoading ? (
              "Migrating..."
            ) : (
              <>
                <span>Start Migration</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
