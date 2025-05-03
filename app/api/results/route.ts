import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  // Check if participant is authenticated
  const participantId = cookies().get("participantId")?.value
  if (!participantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if participant exists
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("id")
      .eq("id", participantId)
      .maybeSingle()

    if (participantError || !participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 401 })
    }

    // Get game status
    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .select("status")
      .eq("id", "current")
      .maybeSingle()

    if (gameError) {
      throw gameError
    }

    // Only show results if the game is in results mode
    if (!game || game.status !== "results") {
      return NextResponse.json({ waiting: true })
    }

    // Get all questions with answers from this participant
    const { data: answers, error: answersError } = await supabaseAdmin
      .from("answers")
      .select(`
        id,
        answer,
        is_correct,
        questions (
          id,
          question,
          image_url,
          correct_answer
        )
      `)
      .eq("participant_id", participantId)

    if (answersError) {
      throw answersError
    }

    // Format the results for the frontend
    const results = answers.map((a) => ({
      questionId: a.questions.id,
      question: a.questions.question,
      imageUrl: a.questions.image_url,
      correctAnswer: a.questions.correct_answer,
      yourAnswer: a.answer,
      isCorrect: a.is_correct,
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Error fetching results:", error)
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 })
  }
}
