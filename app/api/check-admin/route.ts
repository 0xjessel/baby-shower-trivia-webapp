import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  const isAdmin = !!adminToken

  return NextResponse.json({ isAdmin })
}
