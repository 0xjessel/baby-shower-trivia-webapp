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

    if (gameError) {
      console.error("Error fetching active game:", gameError)
      return NextResponse.json({ error: "Failed to fetch game state" }, { status: 500 })
    }

    // If there's no active game or no active question
    if (!activeGame || !activeGame.current_question_id || activeGame.status !== "active") {
      return NextResponse.json({ waiting: true, gameStatus: activeGame?.status || "waiting" })
    }

    // Add debugging to help diagnose the issue
    console.log("[CURRENT-QUESTION] Game state:", {
      gameId: activeGame.id,
      currentQuestionId: activeGame.current_question_id,
      status: activeGame.status,
      isActive: !!activeGame.current_question_id && activeGame.status === "active",
    })

    // Check if we can use cached data
    const now = Date.now()
    if (cache.data && cache.timestamp > now - CACHE_TTL && cache.questionId === activeGame.current_question_id) {
      // Add participant-specific data to cached response
      const cachedData = { ...cache.data }

      // Check if the participant has already answered this question
      const { data: answer, error: answerError } = await supabaseAdmin
        .from("answers")
        .select("answer_option_id")
        .eq("participant_id", participantId)
        .eq("question_id", activeGame.current_question_id)
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
        gameStatus: activeGame.status,
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
        // Try to get the question with all fields we need
        // If is_opinion_question doesn't exist, Supabase will just ignore it
        const response = await supabaseAdmin
          .from("questions")
          .select("id, type, question, image_url, options, allows_custom_answers, no_correct_answer")
          .eq("id", activeGame.current_question_id)
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
        addedBy: option.added_by_name || "Anonymous",
      }))

    // Get all options (predefined + custom)
    const allOptions = answerOptions.map((option) => option.text)

    // For now, use no_correct_answer as a proxy for isOpinionQuestion
    // This will work until we add the actual column
    const isOpinionQuestion = question.no_correct_answer || false

    // Prepare response data
    const responseData = {
      question: {
        id: question.id,
        type: question.type,
        question: question.question,
        imageUrl: question.image_url ? await getSignedUrl(question.image_url) : undefined,
        options: allOptions,
        allowsCustomAnswers: question.allows_custom_answers,
        isOpinionQuestion: isOpinionQuestion,
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
      gameStatus: activeGame.status,
      answered: answer ? true : false,
      selectedAnswer,
    })
  } catch (error) {
    console.error("Error in current-question API:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
