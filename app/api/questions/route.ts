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
    // Get all questions
    const { data: questions, error } = await supabaseAdmin
      .from("questions")
      .select("*")
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
        }
      }),
    )

    return NextResponse.json({ questions: formattedQuestions })
  } catch (error) {
    console.error("Error fetching questions:", error)
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 })
  }
}
