import { cookies } from "next/headers"
import { NextResponse } from "next/server"
// Import the getSignedUrl function
import { supabaseAdmin, getSignedUrl } from "@/lib/supabase"

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
      console.log("Game status is not 'results':", game?.status)
      return NextResponse.json({ waiting: true })
    }

    // Get all answers from this participant
    const { data: answers, error: answersError } = await supabaseAdmin
      .from("answers")
      .select(`
        id, 
        question_id, 
        answer_option_id, 
        is_correct
      `)
      .eq("participant_id", participantId)

    if (answersError) {
      throw answersError
    }

    // Format the results for the frontend
    const results = await Promise.all(
      answers.map(async (a) => {
        // Get the question details
        const { data: question, error: questionError } = await supabaseAdmin
          .from("questions")
          .select("id, question, image_url, correct_answer")
          .eq("id", a.question_id)
          .single()

        if (questionError) {
          console.error("Error fetching question:", questionError)
          return null
        }

        // Get the answer option text
        const { data: answerOption, error: optionError } = await supabaseAdmin
          .from("answer_options")
          .select("text")
          .eq("id", a.answer_option_id)
          .single()

        if (optionError) {
          console.error("Error fetching answer option:", optionError)
          return null
        }

        // Generate a signed URL for the image if it exists
        let imageUrl = question.image_url
        if (imageUrl) {
          imageUrl = await getSignedUrl(imageUrl)
        }

        return {
          questionId: question.id,
          question: question.question,
          imageUrl: imageUrl,
          correctAnswer: question.correct_answer,
          yourAnswer: answerOption.text,
          isCorrect: a.is_correct,
        }
      }),
    )

    // Filter out any null results
    const validResults = results.filter((r) => r !== null)

    return NextResponse.json({ results: validResults })
  } catch (error) {
    console.error("Error fetching results:", error)
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 })
  }
}
