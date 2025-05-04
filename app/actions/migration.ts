"use server"

import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase"
import { pusherServer, GAME_CHANNEL, EVENTS } from "@/lib/pusher-server"
import { generateId } from "@/lib/utils"

export async function migrateFromCurrentGame() {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    console.log("Starting migration from 'current' game...")

    // Check if the "current" game exists
    const { data: currentGame, error: currentGameError } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("id", "current")
      .maybeSingle()

    if (currentGameError) {
      console.error("Error checking for 'current' game:", currentGameError)
      throw currentGameError
    }

    // If there's no "current" game, nothing to migrate
    if (!currentGame) {
      console.log("No 'current' game found, nothing to migrate")
      return { success: true, message: "No 'current' game found, nothing to migrate" }
    }

    // Check if there's already an active game
    const { data: activeGame, error: activeGameError } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("is_active", true)
      .maybeSingle()

    if (activeGameError) {
      console.error("Error checking for active game:", activeGameError)
      throw activeGameError
    }

    let targetGameId: string

    // If there's no active game, create one based on the "current" game
    if (!activeGame) {
      console.log("No active game found, creating one based on 'current' game")

      // Generate a new game ID
      targetGameId = `game_${generateId(16)}`

      // Create a new game with the data from "current"
      const { error: insertError } = await supabaseAdmin.from("games").insert({
        id: targetGameId,
        name: currentGame.name || "Migrated Game",
        description: "Migrated from legacy 'current' game",
        status: currentGame.status,
        current_question_id: currentGame.current_question_id,
        is_active: true,
        created_at: new Date().toISOString(),
      })

      if (insertError) {
        console.error("Error creating new game:", insertError)
        throw insertError
      }
    } else {
      // Use the existing active game
      targetGameId = activeGame.id

      // Update the active game with the current game's state if needed
      if (currentGame.current_question_id || currentGame.status !== activeGame.status) {
        const { error: updateError } = await supabaseAdmin
          .from("games")
          .update({
            current_question_id: currentGame.current_question_id || activeGame.current_question_id,
            status: currentGame.status || activeGame.status,
          })
          .eq("id", targetGameId)

        if (updateError) {
          console.error("Error updating active game:", updateError)
          throw updateError
        }
      }
    }

    // Update all questions that reference "current" to point to the target game
    const { error: updateQuestionsError } = await supabaseAdmin
      .from("questions")
      .update({ game_id: targetGameId })
      .eq("game_id", "current")

    if (updateQuestionsError) {
      console.error("Error updating questions:", updateQuestionsError)
      throw updateQuestionsError
    }

    // Delete the "current" game
    const { error: deleteError } = await supabaseAdmin.from("games").delete().eq("id", "current")

    if (deleteError) {
      console.error("Error deleting 'current' game:", deleteError)
      throw deleteError
    }

    // Notify clients of the change
    try {
      await pusherServer.trigger(GAME_CHANNEL, EVENTS.GAME_CHANGE, {
        gameId: targetGameId,
        timestamp: Date.now(),
      })
    } catch (pusherError) {
      console.error("Error triggering Pusher event:", pusherError)
      // Continue execution even if Pusher fails
    }

    return {
      success: true,
      message: "Successfully migrated from 'current' game",
      newGameId: targetGameId,
    }
  } catch (error) {
    console.error("Error during migration:", error)
    return { success: false, error: "Failed to migrate from 'current' game" }
  }
}
