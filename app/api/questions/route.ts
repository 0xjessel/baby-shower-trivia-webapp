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
    // Get all questions
    const { data: questions, error } = await supabaseAdmin
      .from("questions")
      .select("*")
      .order("created_at", { ascending: true })

    if (error) {
      throw error
    }

    // Format the questions for the frontend
    const formattedQuestions = questions.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      imageUrl: q.image_url,
      options: q.options,
      correctAnswer: q.correct_answer,
    }))

    return NextResponse.json({ questions: formattedQuestions })
  } catch (error) {
    console.error("Error fetching questions:", error)
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 })
  }
}
