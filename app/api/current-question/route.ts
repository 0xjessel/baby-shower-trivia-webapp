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
      return NextResponse.json({ waiting: true, gameStatus: game?.status || "waiting" })
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

    // Get all answer options for this question (including custom ones)
    const { data: answerOptions, error: optionsError } = await supabaseAdmin
      .from("answer_options")
      .select("id, text, is_custom, added_by_name")
      .eq("question_id", question.id)
      .order("created_at", { ascending: true })

    if (optionsError) {
      throw optionsError
    }

    // Check if the participant has already answered this question
    const { data: answer, error: answerError } = await supabaseAdmin
      .from("answers")
      .select("answer_option_id")
      .eq("participant_id", participantId)
      .eq("question_id", question.id)
      .maybeSingle()

    if (answerError) {
      throw answerError
    }

    // Get the selected answer text if the participant has answered
    let selectedAnswer = null
    if (answer) {
      const { data: selectedOption, error: selectedError } = await supabaseAdmin
        .from("answer_options")
        .select("text")
        .eq("id", answer.answer_option_id)
        .single()

      if (!selectedError && selectedOption) {
        selectedAnswer = selectedOption.text
      }
    }

    // Format custom answers for the frontend
    const customAnswers = answerOptions
      .filter((option) => option.is_custom)
      .map((option) => ({
        id: option.id,
        text: option.text,
        addedBy: option.added_by_name,
      }))

    // Get all options (predefined + custom)
    const allOptions = answerOptions.map((option) => option.text)

    return NextResponse.json({
      question: {
        id: question.id,
        type: question.type,
        question: question.question,
        imageUrl: question.image_url,
        options: allOptions,
      },
      gameStatus: game.status,
      customAnswers,
      answered: answer ? true : false,
      selectedAnswer,
    })
  } catch (error) {
    console.error("Error fetching current question:", error)
    return NextResponse.json({ error: "Failed to fetch current question" }, { status: 500 })
  }
}
