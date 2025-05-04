import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

// Add caching to reduce database load
const cache = new Map()
const CACHE_TTL = 2000 // 2 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const questionId = searchParams.get("questionId")

  if (!questionId) {
    return NextResponse.json({ error: "Question ID is required" }, { status: 400 })
  }

  // Check cache first
  const cacheKey = `vote-counts-${questionId}`
  const cachedData = cache.get(cacheKey)
  const now = Date.now()

  if (cachedData && cachedData.timestamp > now - CACHE_TTL) {
    return NextResponse.json(cachedData.data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  }

  try {
    // Get all answer options for this question
    const { data: options, error: optionsError } = await supabaseAdmin
      .from("answer_options")
      .select("id, text")
      .eq("question_id", questionId)

    if (optionsError) {
      console.error("Error fetching options:", optionsError)
      return NextResponse.json({ error: "Failed to fetch answer options" }, { status: 500 })
    }

    // Get all answers for this question
    const { data: answers, error: answersError } = await supabaseAdmin
      .from("answers")
      .select("answer_option_id")
      .eq("question_id", questionId)

    if (answersError) {
      console.error("Error fetching answers:", answersError)
      return NextResponse.json({ error: "Failed to fetch answers" }, { status: 500 })
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

    const responseData = {
      voteCounts,
      totalVotes: answers.length,
      questionId: questionId,
      timestamp: new Date().toISOString(),
    }

    // Update cache
    cache.set(cacheKey, {
      data: responseData,
      timestamp: now,
    })

    console.log(`Vote counts for question ${questionId}:`, voteCounts, "Total votes:", answers.length)

    return NextResponse.json(responseData, {
      headers: {
        // Add cache control headers to prevent caching
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    console.error("Error fetching vote counts:", error)
    return NextResponse.json({ error: "Failed to fetch vote counts" }, { status: 500 })
  }
}
