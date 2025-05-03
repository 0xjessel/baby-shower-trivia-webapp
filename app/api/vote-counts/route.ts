import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const questionId = searchParams.get("questionId")

  if (!questionId) {
    return NextResponse.json({ error: "Question ID is required" }, { status: 400 })
  }

  try {
    // Get all answer options for this question
    const { data: options, error: optionsError } = await supabaseAdmin
      .from("answer_options")
      .select("id, text")
      .eq("question_id", questionId)

    if (optionsError) {
      throw optionsError
    }

    // Get all answers for this question
    const { data: answers, error: answersError } = await supabaseAdmin
      .from("answers")
      .select("answer_option_id")
      .eq("question_id", questionId)

    if (answersError) {
      throw answersError
    }

    // Count votes for each option
    const voteCounts: { [key: string]: number } = {}

    // Initialize all options with 0 votes
    options.forEach((option) => {
      voteCounts[option.text] = 0
    })

    // Count actual votes
    answers.forEach((answer) => {
      const option = options.find((o) => o.id === answer.answer_option_id)
      if (option) {
        voteCounts[option.text] = (voteCounts[option.text] || 0) + 1
      }
    })

    return NextResponse.json({
      voteCounts,
      totalVotes: answers.length,
    })
  } catch (error) {
    console.error("Error fetching vote counts:", error)
    return NextResponse.json({ error: "Failed to fetch vote counts" }, { status: 500 })
  }
}
