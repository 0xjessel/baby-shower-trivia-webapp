"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { supabaseAdmin } from "@/lib/supabase"
import { pusherServer, GAME_CHANNEL, EVENTS } from "@/lib/pusher-server"
import { generateId } from "@/lib/utils"

// Create a new game
export async function createGame({ name, description }: { name: string; description?: string }) {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Generate a unique ID for the game (using a prefix to make it clear it's not a UUID)
    const gameId = `game_${generateId(16)}`

    // Insert the new game
    const { error } = await supabaseAdmin.from("games").insert({
      id: gameId,
      name,
      description: description || null,
      status: "waiting",
      is_active: false,
    })

    if (error) throw error

    return { success: true, gameId }
  } catch (error) {
    console.error("Error creating game:", error)
    return { success: false, error: "Failed to create game" }
  }
}

// Set a game as active
export async function setActiveGame(gameId: string) {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // First, set all games to inactive
    const { error: updateError } = await supabaseAdmin.from("games").update({ is_active: false }).neq("id", "none")

    if (updateError) throw updateError

    // Then, set the selected game to active
    const { error } = await supabaseAdmin.from("games").update({ is_active: true }).eq("id", gameId)

    if (error) throw error

    // Trigger Pusher event to notify all clients about the game change
    try {
      await pusherServer.trigger(GAME_CHANNEL, EVENTS.GAME_CHANGE, {
        gameId,
        timestamp: Date.now(),
      })
    } catch (pusherError) {
      console.error("Error triggering Pusher event:", pusherError)
      // Continue execution even if Pusher fails
    }

    return { success: true }
  } catch (error) {
    console.error("Error setting active game:", error)
    return { success: false, error: "Failed to set active game" }
  }
}

// Delete a game
export async function deleteGame(gameId: string) {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Check if the game is active
    const { data: game, error: checkError } = await supabaseAdmin
      .from("games")
      .select("is_active")
      .eq("id", gameId)
      .single()

    if (checkError) throw checkError

    if (game.is_active) {
      return { success: false, error: "Cannot delete an active game" }
    }

    // Get all questions for this game
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("game_id", gameId)

    if (questionsError) throw questionsError

    // Delete all answers for questions in this game
    if (questions && questions.length > 0) {
      const questionIds = questions.map((q) => q.id)

      // Delete answers for these questions
      const { error: answersError } = await supabaseAdmin.from("answers").delete().in("question_id", questionIds)

      if (answersError) {
        console.error("Error deleting answers:", answersError)
        // Continue with deletion even if this fails
      }

      // Delete answer options for these questions
      const { error: optionsError } = await supabaseAdmin.from("answer_options").delete().in("question_id", questionIds)

      if (optionsError) {
        console.error("Error deleting answer options:", optionsError)
        // Continue with deletion even if this fails
      }

      // Delete questions
      const { error: deleteQuestionsError } = await supabaseAdmin.from("questions").delete().eq("game_id", gameId)

      if (deleteQuestionsError) throw deleteQuestionsError
    }

    // Finally, delete the game
    const { error } = await supabaseAdmin.from("games").delete().eq("id", gameId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error deleting game:", error)
    return { success: false, error: "Failed to delete game" }
  }
}

// Reset all games
export async function resetGame() {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Reset all game states
    const { error: gameError } = await supabaseAdmin
      .from("games")
      .update({
        current_question_id: null,
        status: "waiting",
      })
      .neq("id", "none") // Update all games

    if (gameError) throw gameError

    // Delete all answers
    const { data: allAnswers, error: fetchError } = await supabaseAdmin.from("answers").select("id")

    if (fetchError) throw fetchError

    // If there are answers, delete them in batches or one by one
    if (allAnswers && allAnswers.length > 0) {
      console.log(`Deleting ${allAnswers.length} answers...`)

      // Delete answers one by one to avoid UUID syntax issues
      for (const answer of allAnswers) {
        const { error: deleteError } = await supabaseAdmin.from("answers").delete().eq("id", answer.id)

        if (deleteError) {
          console.error(`Error deleting answer ${answer.id}:`, deleteError)
          // Continue with other deletions even if one fails
        }
      }
    }

    // Clear all custom answers (stored in answer_options with is_custom=true)
    const { error: customAnswersError } = await supabaseAdmin.from("answer_options").delete().eq("is_custom", true)

    if (customAnswersError) {
      console.error("Error deleting custom answers:", customAnswersError)
      // Continue even if custom answer deletion fails
    }

    // Delete all participants
    const { data: allParticipants, error: participantsError } = await supabaseAdmin.from("participants").select("id")

    if (participantsError) {
      console.error("Error fetching participants:", participantsError)
    } else if (allParticipants && allParticipants.length > 0) {
      console.log(`Deleting ${allParticipants.length} participants...`)

      // Delete participants one by one to avoid UUID syntax issues
      for (const participant of allParticipants) {
        const { error: deleteError } = await supabaseAdmin.from("participants").delete().eq("id", participant.id)

        if (deleteError) {
          console.error(`Error deleting participant ${participant.id}:`, deleteError)
          // Continue with other deletions even if one fails
        }
      }
    }

    // Trigger Pusher event to notify all clients
    try {
      await pusherServer.trigger(GAME_CHANNEL, EVENTS.GAME_RESET, {})
    } catch (pusherError) {
      console.error("Error triggering Pusher event:", pusherError)
      // Continue execution even if Pusher fails
    }

    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error resetting games:", error)
    return { success: false, error: "Failed to reset games" }
  }
}

// Reset a single game
export async function resetSingleGame(gameId: string) {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Reset the specific game state
    const { error: gameError } = await supabaseAdmin
      .from("games")
      .update({
        current_question_id: null,
        status: "waiting",
      })
      .eq("id", gameId)

    if (gameError) throw gameError

    // Get all questions for this game
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("game_id", gameId)

    if (questionsError) throw questionsError

    if (questions && questions.length > 0) {
      const questionIds = questions.map((q) => q.id)

      // Delete answers for these questions
      for (const questionId of questionIds) {
        const { data: answers, error: answersError } = await supabaseAdmin
          .from("answers")
          .select("id")
          .eq("question_id", questionId)

        if (answersError) {
          console.error(`Error fetching answers for question ${questionId}:`, answersError)
          continue
        }

        if (answers && answers.length > 0) {
          for (const answer of answers) {
            const { error: deleteError } = await supabaseAdmin.from("answers").delete().eq("id", answer.id)

            if (deleteError) {
              console.error(`Error deleting answer ${answer.id}:`, deleteError)
            }
          }
        }

        // Delete custom answers for this question
        const { error: customAnswersError } = await supabaseAdmin
          .from("answer_options")
          .delete()
          .eq("question_id", questionId)
          .eq("is_custom", true)

        if (customAnswersError) {
          console.error(`Error deleting custom answers for question ${questionId}:`, customAnswersError)
        }
      }
    }

    // If this is the active game, trigger a game reset event
    const { data: game, error: gameCheckError } = await supabaseAdmin
      .from("games")
      .select("is_active")
      .eq("id", gameId)
      .single()

    if (!gameCheckError && game && game.is_active) {
      try {
        await pusherServer.trigger(GAME_CHANNEL, EVENTS.GAME_RESET, {})
      } catch (pusherError) {
        console.error("Error triggering Pusher event:", pusherError)
      }
    }

    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error resetting game:", error)
    return { success: false, error: "Failed to reset game" }
  }
}

// Reset all votes without resetting the entire game
export async function resetVotes() {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Get all answers first
    const { data: allAnswers, error: fetchError } = await supabaseAdmin.from("answers").select("id")

    if (fetchError) throw fetchError

    // If there are answers, delete them in batches or one by one
    if (allAnswers && allAnswers.length > 0) {
      console.log(`Deleting ${allAnswers.length} votes...`)

      // Delete answers one by one to avoid UUID syntax issues
      for (const answer of allAnswers) {
        const { error: deleteError } = await supabaseAdmin.from("answers").delete().eq("id", answer.id)

        if (deleteError) {
          console.error(`Error deleting answer ${answer.id}:`, deleteError)
          // Continue with other deletions even if one fails
        }
      }
    }

    // Clear all custom answers (stored in answer_options with is_custom=true)
    const { error: customAnswersError } = await supabaseAdmin.from("answer_options").delete().eq("is_custom", true)

    if (customAnswersError) {
      console.error("Error deleting custom answers:", customAnswersError)
      // Continue even if custom answer deletion fails
    }

    // Trigger Pusher event to notify all clients about vote updates
    try {
      // For each active question, broadcast an empty vote count
      const { data: activeGame } = await supabaseAdmin
        .from("games")
        .select("current_question_id")
        .eq("is_active", true)
        .single()

      if (activeGame?.current_question_id) {
        await pusherServer.trigger(GAME_CHANNEL, EVENTS.VOTE_UPDATE, {
          voteCounts: {},
          totalVotes: 0,
          questionId: activeGame.current_question_id,
          timestamp: new Date().toISOString(),
          source: "resetVotes",
        })
      }
    } catch (pusherError) {
      console.error("Error triggering Pusher event:", pusherError)
      // Continue execution even if Pusher fails
    }

    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error resetting votes:", error)
    return { success: false, error: "Failed to reset votes" }
  }
}

// Reset all players (remove all participants from the game)
export async function resetPlayers() {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }
  try {
    // Delete all participants
    const { error } = await supabaseAdmin.from("participants").delete().neq("id", "none")
    if (error) throw error
    // Optionally, trigger a Pusher event here if needed
    revalidatePath("/admin/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Error resetting players:", error)
    return { success: false, error: "Failed to reset players" }
  }
}
