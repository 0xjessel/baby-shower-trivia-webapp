import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { supabaseAdmin, getSignedUrl } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/rate-limiter"

// Simple in-memory cache to reduce database load
let cache = {
  data: null,
  timestamp: 0,
  questionId: null,
}

// Cache TTL in milliseconds (2 seconds)
const CACHE_TTL = 2000

export async function GET() {
  try {
    // Check if participant is authenticated
    const participantId = cookies().get("participantId")?.value
    if (!participantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Apply rate limiting
    if (!checkRateLimit(`current-question-${participantId}`, 30)) {
      return NextResponse.json(
        { error: "Too Many Requests", waiting: true },
        { status: 429, headers: { "Retry-After": "5" } },
      )
    }

    // Get current game state first to determine if we need to fetch question details
    const { data: activeGame, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id, current_question_id, status")
      .eq("is_active", true)
      .single()

    let game

    if (gameError) {
      // Fall back to the "current" game for backward compatibility
      const { data: fallbackGame, error: fallbackError } = await supabaseAdmin
        .from("games")
        .select("current_question_id, status")
        .eq("id", "current")
        .maybeSingle()

      if (fallbackError) {
        console.error("Error fetching game state:", fallbackError)
        return NextResponse.json({ error: "Failed to fetch game state" }, { status: 500 })
      }

      game = fallbackGame
    } else {
      game = activeGame
    }

    // If there's no active question or game is in waiting state
    if (!game || !game.current_question_id || game.status !== "active") {
      return NextResponse.json({ waiting: true, gameStatus: game?.status || "waiting" })
    }

    // Check if we can use cached data
    const now = Date.now()
    if (cache.data && cache.timestamp > now - CACHE_TTL && cache.questionId === game.current_question_id) {
      // Add participant-specific data to cached response
      const cachedData = { ...cache.data }

      // Check if the participant has already answered this question
      const { data: answer, error: answerError } = await supabaseAdmin
        .from("answers")
        .select("answer_option_id")
        .eq("participant_id", participantId)
        .eq("question_id", game.current_question_id)
        .maybeSingle()

      if (answerError) {
        console.error("Error checking participant answer:", answerError)
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

      return NextResponse.json({
        ...cachedData,
        answered: answer ? true : false,
        selectedAnswer,
        gameStatus: game.status,
      })
    }

    // Check if participant exists
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("id")
      .eq("id", participantId)
      .maybeSingle()

    if (participantError || !participant) {
      console.error("Error checking participant:", participantError)
      return NextResponse.json({ error: "Participant not found" }, { status: 401 })
    }

    // Get the current question with retry logic
    let question = null
    let questionError = null
    let retries = 3

    while (retries > 0 && !question) {
      try {
        const response = await supabaseAdmin
          .from("questions")
          .select("id, type, question, image_url, options, allows_custom_answers")
          .eq("id", game.current_question_id)
          .single()

        question = response.data
        questionError = response.error

        if (questionError) {
          console.error(`Error fetching question (attempt ${4 - retries}/3):`, questionError)
          retries--
          if (retries > 0) {
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, 500))
          }
        }
      } catch (err) {
        console.error(`Unexpected error fetching question (attempt ${4 - retries}/3):`, err)
        retries--
        if (retries > 0) {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
    }

    if (!question) {
      return NextResponse.json({ error: "Failed to fetch question after multiple attempts" }, { status: 500 })
    }

    // Get all answer options for this question (including custom ones)
    const { data: answerOptions, error: optionsError } = await supabaseAdmin
      .from("answer_options")
      .select("id, text, is_custom, added_by_name")
      .eq("question_id", question.id)
      .order("created_at", { ascending: true })

    if (optionsError) {
      console.error("Error fetching answer options:", optionsError)
      return NextResponse.json({ error: "Failed to fetch answer options" }, { status: 500 })
    }

    // Check if the participant has already answered this question
    const { data: answer, error: answerError } = await supabaseAdmin
      .from("answers")
      .select("answer_option_id")
      .eq("participant_id", participantId)
      .eq("question_id", question.id)
      .maybeSingle()

    if (answerError) {
      console.error("Error checking participant answer:", answerError)
      return NextResponse.json({ error: "Failed to check participant answer" }, { status: 500 })
    }

    // Get the selected answer text if the participant has answered
    let selectedAnswer = null
    if (answer) {
      const { data: selectedOption, error: selectedError } = await supabaseAdmin
        .from("answer_options")
        .select("text")
        .eq("id", answer.answer_option_id)
        .single()

      if (selectedError) {
        console.error("Error fetching selected option:", selectedError)
      } else if (selectedOption) {
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

    // Prepare response data
    const responseData = {
      question: {
        id: question.id,
        type: question.type,
        question: question.question,
        imageUrl: question.image_url ? await getSignedUrl(question.image_url) : undefined,
        options: allOptions,
        allowsCustomAnswers: question.allows_custom_answers,
      },
      customAnswers,
    }

    // Update cache
    cache = {
      data: responseData,
      timestamp: now,
      questionId: question.id,
    }

    return NextResponse.json({
      ...responseData,
      gameStatus: game.status,
      answered: answer ? true : false,
      selectedAnswer,
    })
  } catch (error) {
    console.error("Error in current-question API:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
