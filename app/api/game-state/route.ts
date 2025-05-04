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
      throw gameError
    }

    // If no active game, fall back to the "current" game for backward compatibility
    if (!activeGame) {
      const { data: fallbackGame, error: fallbackError } = await supabaseAdmin
        .from("games")
        .select("current_question_id, status")
        .eq("id", "current")
        .maybeSingle()

      if (fallbackError) {
        throw fallbackError
      }

      return NextResponse.json({
        currentQuestionId: fallbackGame?.current_question_id || null,
        status: fallbackGame?.status || "waiting",
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
