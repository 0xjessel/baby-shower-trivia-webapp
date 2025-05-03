import { NextResponse } from "next/server"

export async function GET() {
  // Only return the necessary configuration for the client
  // No sensitive secrets are exposed
  return NextResponse.json({
    key: process.env.PUSHER_KEY,
    cluster: process.env.PUSHER_CLUSTER,
  })
}
