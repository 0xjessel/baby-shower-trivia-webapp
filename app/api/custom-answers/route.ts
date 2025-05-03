import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const questionId = searchParams.get("questionId")

  if (!questionId) {
    return NextResponse.json({ error: "Question ID is required" }, { status: 400 })
  }

  try {
    // Get all custom answers for this question
    const { data, error } = await supabaseAdmin
      .from("answer_options")
      .select("id, text, added_by_name")
      .eq("question_id", questionId)
      .eq("is_custom", true)
      .order("created_at", { ascending: true })

    if (error) {
      throw error
    }

    // Format the custom answers for the frontend
    const customAnswers = data.map((item) => ({
      id: item.id,
      text: item.text,
      addedBy: item.added_by_name,
    }))

    return NextResponse.json({ customAnswers })
  } catch (error) {
    console.error("Error fetching custom answers:", error)
    return NextResponse.json({ error: "Failed to fetch custom answers" }, { status: 500 })
  }
}
