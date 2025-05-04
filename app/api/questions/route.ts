import { cookies } from "next/headers"
import { NextResponse } from "next/server"
// Import the getSignedUrl function
import { supabaseAdmin, getSignedUrl } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/rate-limiter"

export async function GET() {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Apply rate limiting
  const rateCheck = checkRateLimit(`admin-questions-${adminToken.substring(0, 8)}`, 20)
  if (!rateCheck.allowed) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": `${rateCheck.retryAfter || 10}`,
      },
    })
  }

  try {
    // Get the active game
    const { data: activeGame, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id")
      .eq("is_active", true)
      .single()

    if (gameError) {
      throw gameError
    }

    const activeGameId = activeGame?.id || "current"

    // Get all questions for the active game
    const { data: questions, error } = await supabaseAdmin
      .from("questions")
      .select("*")
      .eq("game_id", activeGameId)
      .order("created_at", { ascending: true })

    if (error) {
      throw error
    }

    // Format the questions for the frontend
    const formattedQuestions = await Promise.all(
      questions.map(async (q) => {
        // Generate a signed URL for the image if it exists
        let imageUrl = q.image_url
        if (imageUrl) {
          imageUrl = await getSignedUrl(imageUrl)
        }

        return {
          id: q.id,
          type: q.type,
          question: q.question,
          imageUrl: imageUrl,
          options: q.options,
          correctAnswer: q.correct_answer,
          allowsCustomAnswers: q.allows_custom_answers,
          gameId: q.game_id,
        }
      }),
    )

    return NextResponse.json({ questions: formattedQuestions })
  } catch (error) {
    console.error("Error fetching questions:", error)
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 })
  }
}
