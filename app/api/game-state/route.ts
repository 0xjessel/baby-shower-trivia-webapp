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
    // Get current game state
    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .select("current_question_id, status")
      .eq("id", "current")
      .maybeSingle()

    if (gameError) {
      throw gameError
    }

    return NextResponse.json({
      currentQuestionId: game?.current_question_id || null,
      status: game?.status || "waiting",
    })
  } catch (error) {
    console.error("Error fetching game state:", error)
    return NextResponse.json({ error: "Failed to fetch game state" }, { status: 500 })
  }
}
