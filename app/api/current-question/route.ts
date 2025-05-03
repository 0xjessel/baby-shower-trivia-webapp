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

    // Get current game state
    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .select("current_question_id, status")
      .eq("id", "current")
      .maybeSingle()

    if (gameError) {
      throw gameError
    }

    if (!game || !game.current_question_id || game.status !== "active") {
      return NextResponse.json({ waiting: true })
    }

    // Get the current question
    const { data: question, error: questionError } = await supabaseAdmin
      .from("questions")
      .select("id, type, question, image_url, options")
      .eq("id", game.current_question_id)
      .single()

    if (questionError) {
      throw questionError
    }

    // Check if the participant has already answered this question
    const { data: answer, error: answerError } = await supabaseAdmin
      .from("answers")
      .select("answer")
      .eq("participant_id", participantId)
      .eq("question_id", question.id)
      .maybeSingle()

    if (answerError) {
      throw answerError
    }

    return NextResponse.json({
      question: {
        id: question.id,
        type: question.type,
        question: question.question,
        imageUrl: question.image_url,
        options: question.options,
      },
      answered: answer ? true : false,
      selectedAnswer: answer ? answer.answer : null,
    })
  } catch (error) {
    console.error("Error fetching current question:", error)
    return NextResponse.json({ error: "Failed to fetch current question" }, { status: 500 })
  }
}
