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
    // Get the active game
    const { data: game, error } = await supabaseAdmin
      .from("games")
      .select("id, name, description, status, current_question_id")
      .eq("is_active", true)
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({ game })
  } catch (error) {
    console.error("Error fetching active game:", error)
    return NextResponse.json({ error: "Failed to fetch active game" }, { status: 500 })
  }
}
