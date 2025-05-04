import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get active game
    const { data: activeGame, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id, current_question_id, status")
      .eq("is_active", true)
      .single()

    if (gameError) {
      console.error("Error fetching active game:", gameError)
      return NextResponse.json({ error: "Failed to fetch game state" }, { status: 500 })
    }

    if (!activeGame) {
      return NextResponse.json({
        currentQuestionId: null,
        status: "waiting",
        gameId: null,
      })
    }

    return NextResponse.json({
      currentQuestionId: activeGame.current_question_id || null,
      status: activeGame.status || "waiting",
      gameId: activeGame.id,
    })
  } catch (error) {
    console.error("Error fetching game state:", error)
    return NextResponse.json({ error: "Failed to fetch game state" }, { status: 500 })
  }
}
