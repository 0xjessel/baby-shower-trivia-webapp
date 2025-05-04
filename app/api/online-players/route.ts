import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getActivePlayers, ACTIVITY_TIMEOUT } from "../player-heartbeat/route"

export async function GET() {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get active players from the activity tracking system
    const activePlayers = getActivePlayers()

    // Get current game state to find active question
    const currentQuestionId = cookies().get("currentQuestionId")?.value

    // Return the count of active players
    return NextResponse.json({
      count: activePlayers.length,
      activeTimeout: ACTIVITY_TIMEOUT / 1000, // in seconds
      currentQuestionId,
    })
  } catch (error) {
    console.error("Error fetching online players count:", error)
    return NextResponse.json({ error: "Failed to fetch online players count" }, { status: 500 })
  }
}
