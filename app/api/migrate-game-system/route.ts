import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { pusherServer } from "@/lib/pusher-server"

export async function POST() {
  try {
    const supabase = createClient()

    // Check if admin is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the active game
    const { data: activeGameData, error: activeGameError } = await supabase
      .from("games")
      .select("id, name")
      .eq("is_active", true)
      .single()

    if (activeGameError || !activeGameData) {
      return NextResponse.json(
        { error: "No active game found. Please set an active game before migration." },
        { status: 400 },
      )
    }

    const activeGameId = activeGameData.id

    // Begin transaction
    const { error: transactionError } = await supabase.rpc("migrate_to_active_game_system", {
      p_active_game_id: activeGameId,
    })

    if (transactionError) {
      console.error("Migration transaction error:", transactionError)
      return NextResponse.json({ error: "Failed to migrate game system: " + transactionError.message }, { status: 500 })
    }

    // Notify all clients about the migration
    await pusherServer.trigger("game-channel", "GAME_CHANGE", {
      message: "Game system has been migrated",
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: "Game system successfully migrated to active game",
      activeGameId,
      activeGameName: activeGameData.name,
    })
  } catch (error) {
    console.error("Migration error:", error)
    return NextResponse.json({ error: "An unexpected error occurred during migration" }, { status: 500 })
  }
}
