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
      .select("id, name")
      .eq("id", participantId)
      .maybeSingle()

    if (participantError || !participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 401 })
    }

    // Get active game
    const { data: activeGame, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id, status")
      .eq("is_active", true)
      .maybeSingle()

    if (gameError) {
      throw gameError
    }

    // Only show results if the game is in results mode
    if (!activeGame || activeGame.status !== "results") {
      console.log("Game status is not 'results':", activeGame?.status)
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
          correctAnswer: question.correct_answer || "No correct answer",
          yourAnswer: answerOption.text,
          isCorrect: a.is_correct,
        }
      }),
    )

    // Filter out any null results
    const validResults = results.filter((r) => r !== null)

    // Calculate participant rankings directly instead of using the SQL function
    // First, get all participants and their correct answer counts
    const { data: participantScores, error: scoresError } = await supabaseAdmin.from("participants").select(`
        id,
        name,
        answers!inner(id, is_correct)
      `)

    if (scoresError) {
      console.error("Error fetching participant scores:", scoresError)
      return NextResponse.json({ results: validResults }) // Return results without ranking if there's an error
    }

    // Calculate correct answers for each participant
    const rankings = participantScores.map((p) => {
      const correctAnswers = p.answers.filter((a: any) => a.is_correct).length
      return {
        participant_id: p.id,
        participant_name: p.name,
        correct_answers: correctAnswers,
      }
    })

    // Sort by correct answers (descending)
    rankings.sort((a, b) => b.correct_answers - a.correct_answers)

    // Add rank
    rankings.forEach((r, index) => {
      r.rank = index + 1
    })

    // Find the current participant's rank
    const participantRanking = rankings.find((r) => r.participant_id === participantId)
    const rank = participantRanking ? participantRanking.rank : null
    const totalParticipants = rankings.length

    // Get top 3 winners
    const topWinners = rankings
      .filter((r) => r.rank <= 3)
      .map((r) => ({
        name: r.participant_name,
        rank: r.rank,
        score: r.correct_answers,
      }))
      .sort((a, b) => a.rank - b.rank)

    return NextResponse.json({
      results: validResults,
      rank,
      totalParticipants,
      totalCorrect: participantRanking ? participantRanking.correct_answers : 0,
      topWinners,
    })
  } catch (error) {
    console.error("Error fetching results:", error)
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 })
  }
}
