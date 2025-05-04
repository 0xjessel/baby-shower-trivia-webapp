import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: Request) {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { questionId, correctAnswer } = await request.json()
    if (!questionId || typeof correctAnswer !== "string") {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Update the correct answer for the question
    const { error } = await supabaseAdmin
      .from("questions")
      .update({ correct_answer: correctAnswer })
      .eq("id", questionId)

    if (error) {
      return NextResponse.json({ success: false, error: "Failed to update correct answer" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating correct answer:", error)
    return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 })
  }
}
