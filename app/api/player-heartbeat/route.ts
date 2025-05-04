import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// In-memory store for active players
// In a production app with multiple instances, this should be in Redis or similar
type ActivePlayer = {
  id: string
  lastActive: number
}

// Global store of active players
const activePlayers = new Map<string, ActivePlayer>()

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000

// Activity timeout (2 minutes)
export const ACTIVITY_TIMEOUT = 2 * 60 * 1000

// Set up a cleanup interval to remove inactive players
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [id, player] of activePlayers.entries()) {
      if (now - player.lastActive > ACTIVITY_TIMEOUT) {
        activePlayers.delete(id)
      }
    }
  }, CLEANUP_INTERVAL)
}

export async function POST() {
  const participantId = cookies().get("participantId")?.value

  if (!participantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Update the player's last active timestamp
  activePlayers.set(participantId, {
    id: participantId,
    lastActive: Date.now(),
  })

  return NextResponse.json({ success: true })
}

// Helper function to get active players
export function getActivePlayers(): ActivePlayer[] {
  const now = Date.now()
  return Array.from(activePlayers.values()).filter((player) => now - player.lastActive <= ACTIVITY_TIMEOUT)
}
