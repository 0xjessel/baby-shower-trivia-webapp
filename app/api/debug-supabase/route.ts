import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Test connection
    let connected = false
    try {
      const { data, error } = await supabaseAdmin.from("games").select("count").limit(1)
      connected = !error
    } catch (e) {
      connected = false
    }

    // Get storage buckets
    let buckets = []
    try {
      const { data, error } = await supabaseAdmin.storage.listBuckets()
      if (!error && data) {
        buckets = data
      }
    } catch (e) {
      console.error("Error listing buckets:", e)
    }

    return NextResponse.json({
      connected,
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      buckets,
    })
  } catch (error) {
    console.error("Error in debug-supabase API:", error)
    return NextResponse.json({ error: "Failed to check Supabase configuration" }, { status: 500 })
  }
}
