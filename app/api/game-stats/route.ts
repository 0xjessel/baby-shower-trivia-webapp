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
    // Get all participants with their scores
    const { data: participantsData, error: participantsError } = await supabaseAdmin.from("participants").select(`
        id,
        name
      `)

    if (participantsError) {
      throw participantsError
    }

    // Get all answers to calculate scores
    const { data: answersData, error: answersError } = await supabaseAdmin.from("answers").select(`
        participant_id,
        is_correct
      `)

    if (answersError) {
      throw answersError
    }

    // Calculate scores for each participant
    const participants = participantsData.map((p) => {
      const participantAnswers = answersData.filter((a) => a.participant_id === p.id)
      const correctAnswers = participantAnswers.filter((a) => a.is_correct)

      return {
        name: p.name,
        score: correctAnswers.length,
        totalAnswered: participantAnswers.length,
      }
    })

    // Get question statistics
    const { data: questions, error: questionsError } = await supabaseAdmin.from("questions").select(`
        id,
        question
      `)

    if (questionsError) {
      throw questionsError
    }

    // Calculate statistics for each question
    const questionStats = await Promise.all(
      questions.map(async (q) => {
        const { data: questionAnswers, error: questionAnswersError } = await supabaseAdmin
          .from("answers")
          .select(`
          is_correct
        `)
          .eq("question_id", q.id)

        if (questionAnswersError) {
          throw questionAnswersError
        }

        const totalAnswers = questionAnswers.length
        const correctAnswers = questionAnswers.filter((a) => a.is_correct).length

        return {
          id: q.id,
          question: q.question,
          totalAnswers,
          correctAnswers,
        }
      }),
    )

    return NextResponse.json({ participants, questionStats })
  } catch (error) {
    console.error("Error fetching game stats:", error)
    return NextResponse.json({ error: "Failed to fetch game statistics" }, { status: 500 })
  }
}
