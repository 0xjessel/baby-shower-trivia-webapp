"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { supabaseAdmin } from "@/lib/supabase"
import { pusherServer, GAME_CHANNEL, EVENTS } from "@/lib/pusher-server"
import { generateId, generateUUID } from "@/lib/utils"

// Get admin password from environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

// Join game as a participant
export async function joinGame(name: string) {
  try {
    // Create a new participant with a proper UUID
    const participantId = generateUUID()

    const { error } = await supabaseAdmin.from("participants").insert({
      id: participantId,
      name: name,
    })

    if (error) throw error

    // Store participant ID in a cookie
    cookies().set("participantId", participantId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    })

    return { success: true, participantId }
  } catch (error) {
    console.error("Error joining game:", error)
    return { success: false, error: "Failed to join game" }
  }
}

// Admin login
export async function adminLogin(password: string) {
  if (password === ADMIN_PASSWORD) {
    const adminToken = generateId()

    cookies().set("adminToken", adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    })

    return { success: true }
  }

  return { success: false, error: "Invalid password" }
}

// Map to track last custom answer time for each participant and question
const lastCustomAnswerTime: Record<string, number> = {}

// Add a custom answer
export async function addCustomAnswer(questionId: string, answerText: string) {
  const participantId = cookies().get("participantId")?.value

  console.log("[SERVER] addCustomAnswer - Starting", {
    questionId,
    answerText,
    participantId: participantId ? participantId.substring(0, 8) + "..." : "none", // Log partial ID for privacy
  })

  if (!participantId) {
    console.log("[SERVER] addCustomAnswer - No participant ID, redirecting to join")
    redirect("/join")
  }

  try {
    // Check if this participant has added a custom answer for this question recently
    const key = `${participantId}-${questionId}`
    const now = Date.now()
    const lastCustom = lastCustomAnswerTime[key] || 0

    // If last custom answer was less than 1 second ago, debounce the request
    if (now - lastCustom < 1000) {
      console.log("[SERVER] Debouncing custom answer, too soon after last custom answer")
      return { success: false, error: "Please wait a moment before adding another answer" }
    }

    // Update the last custom answer time
    lastCustomAnswerTime[key] = now
    console.log("[SERVER] Updated last custom answer time")

    // Get participant name
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("name")
      .eq("id", participantId)
      .single()

    if (participantError) {
      console.log("[SERVER] Error getting participant:", participantError)
      throw participantError
    }

    // Get the question to check if custom answers are allowed
    const { data: question, error: questionError } = await supabaseAdmin
      .from("questions")
      .select("allows_custom_answers")
      .eq("id", questionId)
      .single()

    if (questionError) {
      console.log("[SERVER] Error getting question:", questionError)
      throw questionError
    }

    // If custom answers are disabled for this question
    if (question.allows_custom_answers === false) {
      console.log("[SERVER] Custom answers are not allowed for this question")
      return { success: false, error: "Custom answers are not allowed for this question" }
    }

    // Normalize the answer text (trim and convert to lowercase for comparison)
    const normalizedAnswerText = answerText.trim().toLowerCase()

    if (normalizedAnswerText.length === 0) {
      console.log("[SERVER] Answer text is empty")
      return { success: false, error: "Answer cannot be empty" }
    }

    // Check if this answer already exists (case-insensitive)
    const { data: existingOptions, error: optionError } = await supabaseAdmin
      .from("answer_options")
      .select("id, text")
      .eq("question_id", questionId)

    if (optionError) {
      console.log("[SERVER] Error checking existing options:", optionError)
      throw optionError
    }

    // Check for duplicates case-insensitively
    const isDuplicate = existingOptions.some((option) => option.text.toLowerCase() === normalizedAnswerText)

    if (isDuplicate) {
      console.log("[SERVER] Answer is a duplicate")
      return { success: false, error: "This answer already exists" }
    }

    // Add the custom answer option with the original casing (but trimmed)
    const optionId = generateUUID()
    console.log("[SERVER] Adding custom answer to database")
    const { error: insertError } = await supabaseAdmin.from("answer_options").insert({
      id: optionId,
      question_id: questionId,
      text: answerText.trim(),
      is_custom: true,
      added_by_id: participantId,
      added_by_name: participant.name,
    })

    if (insertError) {
      console.log("[SERVER] Error inserting custom answer:", insertError)
      throw insertError
    }

    // Create the custom answer object
    const customAnswer = {
      id: optionId,
      text: answerText.trim(),
      addedBy: participant.name,
    }

    // NEW: Automatically submit a vote for the custom answer
    console.log("[SERVER] Automatically submitting vote for custom answer")

    // Get the question details including correct_answer and no_correct_answer flag
    const { data: questionDetails, error: questionDetailsError } = await supabaseAdmin
      .from("questions")
      .select("correct_answer, no_correct_answer")
      .eq("id", questionId)
      .single()

    if (questionDetailsError) {
      console.log("[SERVER] Error getting question details:", questionDetailsError)
      throw questionDetailsError
    }

    // If the question has no correct answer, all answers are considered "correct" (or none are)
    // For display purposes, we'll consider all answers "correct" for opinion questions
    const isCorrect = questionDetails.no_correct_answer ? true : questionDetails.correct_answer === answerText.trim()

    // Check if the participant has already answered this question
    const { data: existingAnswer, error: checkError } = await supabaseAdmin
      .from("answers")
      .select("id")
      .eq("participant_id", participantId)
      .eq("question_id", questionId)
      .maybeSingle()

    if (checkError) {
      console.log("[SERVER] Error checking existing answer:", checkError)
      throw checkError
    }

    if (existingAnswer) {
      // Update existing answer to the new custom answer
      console.log("[SERVER] Updating existing answer to custom answer")
      const { error: updateError } = await supabaseAdmin
        .from("answers")
        .update({
          answer_option_id: optionId,
          is_correct: isCorrect,
        })
        .eq("id", existingAnswer.id)

      if (updateError) {
        console.log("[SERVER] Error updating answer:", updateError)
        throw updateError
      }
    } else {
      // Insert new answer with a proper UUID
      console.log("[SERVER] Inserting new answer for custom answer")
      const { error: insertAnswerError } = await supabaseAdmin.from("answers").insert({
        id: generateUUID(),
        participant_id: participantId,
        question_id: questionId,
        answer_option_id: optionId,
        is_correct: isCorrect,
      })

      if (insertAnswerError) {
        console.log("[SERVER] Error inserting answer:", insertAnswerError)
        throw insertAnswerError
      }
    }

    // Get updated vote counts after adding the vote
    const { data: voteData, error: voteError } = await getVoteCounts(questionId)

    if (voteError) {
      console.log("[SERVER] Error getting vote counts:", voteError)
      throw voteError
    }

    // Broadcast the new custom answer via Pusher
    try {
      console.log("[SERVER] Broadcasting custom answer via Pusher")
      await pusherServer.trigger(GAME_CHANNEL, EVENTS.CUSTOM_ANSWER_ADDED, {
        customAnswer,
        questionId,
        timestamp: Date.now(), // Add timestamp to make the event unique
        voteCounts: voteData.voteCounts, // Include updated vote counts
        totalVotes: voteData.totalVotes,
      })
      console.log("[SERVER] Pusher event triggered successfully")
    } catch (pusherError) {
      console.error("[SERVER] Error triggering Pusher custom answer event:", pusherError)
      // Continue execution even if Pusher fails
    }

    console.log("[SERVER] addCustomAnswer completed successfully")
    return { success: true, customAnswer, voteCounts: voteData.voteCounts, totalVotes: voteData.totalVotes }
  } catch (error) {
    console.error("[SERVER] Error adding custom answer:", error)
    return { success: false, error: "Failed to add custom answer" }
  }
}

// Map to track last update time for each participant and question
const lastVoteUpdateTime: Record<string, number> = {}

// Update vote count in real-time without submitting an answer
export async function updateVoteCount(questionId: string, selectedAnswer: string, previousAnswer: string | null) {
  const participantId = cookies().get("participantId")?.value

  if (!participantId) {
    redirect("/join")
  }

  try {
    console.log("[SERVER] updateVoteCount called:", {
      questionId,
      selectedAnswer,
      previousAnswer,
      participantId: participantId.substring(0, 8) + "...", // Log partial ID for privacy
    })

    // Check if this participant has updated this question recently
    const key = `${participantId}-${questionId}`
    const now = Date.now()
    const lastUpdate = lastVoteUpdateTime[key] || 0

    // If last update was less than 1 second ago, debounce the request
    if (now - lastUpdate < 1000) {
      console.log("[SERVER] Debouncing vote update, too soon after last update")
      return { success: true, debounced: true }
    }

    // Update the last update time
    lastVoteUpdateTime[key] = now

    // Get the answer option IDs for both the selected and previous answers
    let selectedOptionId = null
    let previousOptionId = null

    // Get the selected answer option ID
    if (selectedAnswer) {
      const { data: selectedOption, error: selectedError } = await supabaseAdmin
        .from("answer_options")
        .select("id")
        .eq("question_id", questionId)
        .eq("text", selectedAnswer)
        .maybeSingle()

      if (selectedError) {
        console.error("[SERVER] Error getting selected option:", selectedError)
        throw selectedError
      }
      if (selectedOption) selectedOptionId = selectedOption.id
    }

    // Get the previous answer option ID if there was one
    if (previousAnswer) {
      const { data: prevOption, error: prevError } = await supabaseAdmin
        .from("answer_options")
        .select("id")
        .eq("question_id", questionId)
        .eq("text", previousAnswer)
        .maybeSingle()

      if (prevError) {
        console.error("[SERVER] Error getting previous option:", prevError)
        throw prevError
      }
      if (prevOption) previousOptionId = prevOption.id
    }

    // Update the participant's temporary selection in a separate table or cache if needed
    // This is optional and depends on your implementation

    // Get updated vote counts for the question
    const { data: voteData, error: voteError } = await getVoteCounts(questionId)

    if (voteError) {
      console.error("[SERVER] Error getting vote counts:", voteError)
      throw voteError
    }

    console.log("[SERVER] Broadcasting vote counts:", voteData)

    // Broadcast vote update via Pusher with more detailed information
    try {
      const eventData = {
        voteCounts: voteData.voteCounts,
        totalVotes: voteData.totalVotes,
        questionId: questionId,
        updatedAt: new Date().toISOString(),
        source: "updateVoteCount",
      }

      console.log("[SERVER] Triggering Pusher event:", EVENTS.VOTE_UPDATE, eventData)
      await pusherServer.trigger(GAME_CHANNEL, EVENTS.VOTE_UPDATE, eventData)
      console.log("[SERVER] Pusher event triggered successfully")
    } catch (pusherError) {
      console.error("[SERVER] Error triggering Pusher vote update event:", pusherError)
      // Continue execution even if Pusher fails
    }

    return { success: true }
  } catch (error) {
    console.error("[SERVER] Error updating vote count:", error)
    return { success: false, error: "Failed to update vote count" }
  }
}

// Map to track last submit time for each participant and question
const lastSubmitTime: Record<string, number> = {}

// Submit answer for a question
export async function submitAnswer(questionId: string, answerText: string) {
  const participantId = cookies().get("participantId")?.value

  if (!participantId) {
    redirect("/join")
  }

  try {
    console.log(`[SERVER] Submitting answer for question ${questionId}: ${answerText}`)

    // Get the answer option ID
    const { data: answerOption, error: optionError } = await supabaseAdmin
      .from("answer_options")
      .select("id")
      .eq("question_id", questionId)
      .eq("text", answerText)
      .single()

    if (optionError) {
      return { success: false, error: "Invalid answer option" }
    }

    // Get the question details including correct_answer and no_correct_answer flag
    const { data: question, error: questionError } = await supabaseAdmin
      .from("questions")
      .select("correct_answer, no_correct_answer")
      .eq("id", questionId)
      .single()

    if (questionError) throw questionError

    // If the question has no correct answer, all answers are considered "correct" (or none are)
    // For display purposes, we'll consider all answers "correct" for opinion questions
    const isCorrect = question.no_correct_answer ? true : question.correct_answer === answerText

    // Check if the participant has already answered this question
    const { data: existingAnswer, error: checkError } = await supabaseAdmin
      .from("answers")
      .select("id")
      .eq("participant_id", participantId)
      .eq("question_id", questionId)
      .maybeSingle()

    if (checkError) throw checkError

    if (existingAnswer) {
      // Get the previous answer option before updating
      const { data: prevAnswer, error: prevAnswerError } = await supabaseAdmin
        .from("answers")
        .select("answer_option_id")
        .eq("id", existingAnswer.id)
        .single()

      if (prevAnswerError) throw prevAnswerError

      // Only update if the answer has actually changed
      if (prevAnswer.answer_option_id !== answerOption.id) {
        console.log(`[SERVER] Updating answer from ${prevAnswer.answer_option_id} to ${answerOption.id}`)

        // Update existing answer
        const { error: updateError } = await supabaseAdmin
          .from("answers")
          .update({
            answer_option_id: answerOption.id,
            is_correct: isCorrect,
          })
          .eq("id", existingAnswer.id)

        if (updateError) throw updateError

        console.log(`[SERVER] Answer updated successfully`)

        // After updating the answer, get updated vote counts and broadcast them
        // This is the missing part - we need to broadcast vote updates when answers change
        const { data: voteData, error: voteError } = await getVoteCounts(questionId)

        if (voteError) throw voteError

        // Broadcast vote update via Pusher with timestamp to ensure uniqueness
        try {
          const timestamp = new Date().toISOString()
          await pusherServer.trigger(GAME_CHANNEL, EVENTS.VOTE_UPDATE, {
            voteCounts: voteData.voteCounts,
            totalVotes: voteData.totalVotes,
            questionId: questionId,
            timestamp: timestamp,
            source: "answerChanged",
          })

          console.log(`[SERVER] Vote update broadcast after answer change at ${timestamp}:`, voteData.voteCounts)
        } catch (pusherError) {
          console.error("Error triggering Pusher vote update event:", pusherError)
          // Continue execution even if Pusher fails
        }
      } else {
        console.log(`[SERVER] Answer unchanged, skipping update`)
      }
    } else {
      // Insert new answer with a proper UUID
      const { error: insertError } = await supabaseAdmin.from("answers").insert({
        id: generateUUID(),
        participant_id: participantId,
        question_id: questionId,
        answer_option_id: answerOption.id,
        is_correct: isCorrect,
      })

      if (insertError) throw insertError
    }

    // After submitting/updating the answer, get updated vote counts
    const { data: voteData, error: voteError } = await getVoteCounts(questionId)

    if (voteError) throw voteError

    // Broadcast vote update via Pusher with timestamp to ensure uniqueness
    try {
      const timestamp = new Date().toISOString()
      await pusherServer.trigger(GAME_CHANNEL, EVENTS.VOTE_UPDATE, {
        voteCounts: voteData.voteCounts,
        totalVotes: voteData.totalVotes,
        questionId: questionId,
        timestamp: timestamp,
        source: "submitAnswer",
      })

      console.log(`[SERVER] Vote update broadcast at ${timestamp}:`, voteData.voteCounts)
    } catch (pusherError) {
      console.error("Error triggering Pusher vote update event:", pusherError)
      // Continue execution even if Pusher fails
    }

    return { success: true }
  } catch (error) {
    console.error("Error submitting answer:", error)
    return { success: false, error: "Failed to submit answer" }
  }
}

// Helper function to get vote counts
async function getVoteCounts(questionId: string) {
  try {
    // Get all answer options for this question
    const { data: options, error: optionsError } = await supabaseAdmin
      .from("answer_options")
      .select("id, text")
      .eq("question_id", questionId)

    if (optionsError) throw optionsError

    // Get all answers for this question with a fresh query
    const { data: answers, error: answersError } = await supabaseAdmin
      .from("answers")
      .select("answer_option_id")
      .eq("question_id", questionId)

    if (answersError) throw answersError

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

    console.log(`[SERVER] Vote counts calculated for ${questionId}:`, voteCounts, "Total votes:", answers.length)

    return {
      data: {
        voteCounts,
        totalVotes: answers.length,
      },
      error: null,
    }
  } catch (error) {
    console.error("Error getting vote counts:", error)
    return { data: null, error: "Failed to get vote counts" }
  }
}

// Helper function to populate answer options
async function populateAnswerOptions(questionId: string, options: string[]) {
  if (!options || options.length === 0) {
    console.log("[SERVER] No options to populate for question:", questionId)
    return
  }

  try {
    // First, check if options already exist for this question
    const { data: existingOptions, error: existingOptionsError } = await supabaseAdmin
      .from("answer_options")
      .select("id")
      .eq("question_id", questionId)

    if (existingOptionsError) {
      console.error("Error checking existing options:", existingOptionsError)
      throw existingOptionsError
    }

    // If options already exist, skip population
    if (existingOptions && existingOptions.length > 0) {
      console.log("[SERVER] Options already exist for question:", questionId, "- skipping population")
      return
    }

    // Prepare the options to be inserted
    const newOptions = options.map((option) => ({
      id: generateUUID(),
      question_id: questionId,
      text: option.trim(),
      is_custom: false,
    }))

    // Insert the new options
    const { error: insertError } = await supabaseAdmin.from("answer_options").insert(newOptions)

    if (insertError) {
      console.error("Error inserting answer options:", insertError)
      throw insertError
    }

    console.log("[SERVER] Successfully populated answer options for question:", questionId)
  } catch (error) {
    console.error("Error populating answer options:", error)
    throw error
  }
}

// Move to next question
export async function nextQuestion() {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Get the active game
    const { data: activeGame, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id, current_question_id")
      .eq("is_active", true)
      .single()

    if (gameError || !activeGame) {
      return { success: false, error: "No active game found" }
    }

    // Get all questions for this game
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("game_id", activeGame.id)
      .order("created_at", { ascending: true })

    if (questionsError) throw questionsError

    if (questions.length === 0) {
      return { success: false, error: "No questions available" }
    }

    let currentIndex = 0

    if (activeGame.current_question_id) {
      // Find the index of the current question
      const currentQuestionIndex = questions.findIndex((q) => q.id === activeGame.current_question_id)
      if (currentQuestionIndex !== -1) {
        currentIndex = (currentQuestionIndex + 1) % questions.length
      }
    }

    // Update the game with the next question
    const { error: updateError } = await supabaseAdmin
      .from("games")
      .update({
        current_question_id: questions[currentIndex].id,
        status: "active",
      })
      .eq("id", activeGame.id)

    if (updateError) throw updateError

    // Get the full question details to send to clients
    const { data: questionDetails, error: detailsError } = await supabaseAdmin
      .from("questions")
      .select("id, type, question, image_url, options, allows_custom_answers")
      .eq("id", questions[currentIndex].id)
      .single()

    if (detailsError) throw detailsError

    // When moving to a new question, we need to pre-populate the answer_options table
    // with the predefined options from the question
    await populateAnswerOptions(questionDetails.id, questionDetails.options)

    // Trigger Pusher event to notify all clients
    try {
      console.log("[SERVER] Triggering QUESTION_UPDATE event via Pusher for question:", questionDetails.id)

      // Add a timestamp to ensure clients recognize this as a new event
      const eventData = {
        question: {
          id: questionDetails.id,
          type: questionDetails.type,
          question: questionDetails.question,
          imageUrl: questionDetails.image_url,
          options: questionDetails.options,
          allowsCustomAnswers: questionDetails.allows_custom_answers,
        },
        timestamp: Date.now(),
      }

      await pusherServer.trigger(GAME_CHANNEL, EVENTS.QUESTION_UPDATE, eventData)
      console.log("[SERVER] Successfully triggered QUESTION_UPDATE event")
    } catch (pusherError) {
      console.error("Error triggering Pusher event:", pusherError)
      // Continue execution even if Pusher fails
    }

    return { success: true }
  } catch (error) {
    console.error("Error advancing to next question:", error)
    return { success: false, error: "Failed to advance to next question" }
  }
}

// Go back to previous question
export async function previousQuestion() {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Get the active game
    const { data: activeGame, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id, current_question_id")
      .eq("is_active", true)
      .single()

    if (gameError || !activeGame) {
      return { success: false, error: "No active game found" }
    }

    // Get all questions for this game
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("game_id", activeGame.id)
      .order("created_at", { ascending: true })

    if (questionsError) throw questionsError

    if (questions.length === 0) {
      return { success: false, error: "No questions available" }
    }

    if (!activeGame.current_question_id) {
      return { success: false, error: "No active question to go back from" }
    }

    // Find the index of the current question
    const currentQuestionIndex = questions.findIndex((q) => q.id === activeGame.current_question_id)
    if (currentQuestionIndex === -1) {
      return { success: false, error: "Current question not found" }
    }

    // Calculate previous question index (with wrap-around)
    const previousIndex = currentQuestionIndex > 0 ? currentQuestionIndex - 1 : questions.length - 1

    // Update the game with the previous question
    const { error: updateError } = await supabaseAdmin
      .from("games")
      .update({
        current_question_id: questions[previousIndex].id,
        status: "active",
      })
      .eq("id", activeGame.id)

    if (updateError) throw updateError

    // Get the full question details to send to clients
    const { data: questionDetails, error: detailsError } = await supabaseAdmin
      .from("questions")
      .select("id, type, question, image_url, options, allows_custom_answers")
      .eq("id", questions[previousIndex].id)
      .single()

    if (detailsError) throw detailsError

    // Trigger Pusher event to notify all clients
    try {
      await pusherServer.trigger(GAME_CHANNEL, EVENTS.QUESTION_UPDATE, {
        question: {
          id: questionDetails.id,
          type: questionDetails.type,
          question: questionDetails.question,
          imageUrl: questionDetails.image_url,
          options: questionDetails.options,
          allowsCustomAnswers: questionDetails.allows_custom_answers,
        },
        timestamp: Date.now(),
      })
    } catch (pusherError) {
      console.error("Error triggering Pusher event:", pusherError)
      // Continue execution even if Pusher fails
    }

    return { success: true }
  } catch (error) {
    console.error("Error going back to previous question:", error)
    return { success: false, error: "Failed to go back to previous question" }
  }
}

// Show results to all participants
export async function showResults() {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Get the active game
    const { data: activeGame, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id")
      .eq("is_active", true)
      .single()

    if (gameError || !activeGame) {
      return { success: false, error: "No active game found" }
    }

    // Update game status to show results
    const { error } = await supabaseAdmin.from("games").update({ status: "results" }).eq("id", activeGame.id)

    if (error) {
      console.error("Database error when updating game status:", error)
      throw error
    }

    // Verify the update was successful
    const { data: game, error: verifyError } = await supabaseAdmin
      .from("games")
      .select("status")
      .eq("id", activeGame.id)
      .single()

    if (verifyError) {
      console.error("Error verifying game status update:", verifyError)
      throw verifyError
    }

    console.log("Game status updated to:", game.status)

    // Trigger Pusher event to notify all clients
    try {
      await pusherServer.trigger(GAME_CHANNEL, EVENTS.SHOW_RESULTS, {
        timestamp: Date.now(),
      })
      console.log("SHOW_RESULTS event triggered successfully")
    } catch (pusherError) {
      console.error("Error triggering Pusher event:", pusherError)
      // Continue execution even if Pusher fails
    }

    return { success: true }
  } catch (error) {
    console.error("Error showing results:", error)
    return { success: false, error: "Failed to show results" }
  }
}

// Reset all games
export async function resetGame() {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Reset all game states
    const { error: gameError } = await supabaseAdmin
      .from("games")
      .update({
        current_question_id: null,
        status: "waiting",
      })
      .neq("id", "none") // Update all games

    if (gameError) throw gameError

    // Delete all answers
    const { data: allAnswers, error: fetchError } = await supabaseAdmin.from("answers").select("id")

    if (fetchError) throw fetchError

    // If there are answers, delete them in batches or one by one
    if (allAnswers && allAnswers.length > 0) {
      console.log(`Deleting ${allAnswers.length} answers...`)

      // Delete answers one by one to avoid UUID syntax issues
      for (const answer of allAnswers) {
        const { error: deleteError } = await supabaseAdmin.from("answers").delete().eq("id", answer.id)

        if (deleteError) {
          console.error(`Error deleting answer ${answer.id}:`, deleteError)
          // Continue with other deletions even if one fails
        }
      }
    }

    // Clear all custom answers (stored in answer_options with is_custom=true)
    const { error: customAnswersError } = await supabaseAdmin.from("answer_options").delete().eq("is_custom", true)

    if (customAnswersError) {
      console.error("Error deleting custom answers:", customAnswersError)
      // Continue even if custom answer deletion fails
    }

    // Delete all participants
    const { data: allParticipants, error: participantsError } = await supabaseAdmin.from("participants").select("id")

    if (participantsError) {
      console.error("Error fetching participants:", participantsError)
    } else if (allParticipants && allParticipants.length > 0) {
      console.log(`Deleting ${allParticipants.length} participants...`)

      // Delete participants one by one to avoid UUID syntax issues
      for (const participant of allParticipants) {
        const { error: deleteError } = await supabaseAdmin.from("participants").delete().eq("id", participant.id)

        if (deleteError) {
          console.error(`Error deleting participant ${participant.id}:`, deleteError)
          // Continue with other deletions even if one fails
        }
      }
    }

    // Trigger Pusher event to notify all clients
    try {
      await pusherServer.trigger(GAME_CHANNEL, EVENTS.GAME_RESET, {})
    } catch (pusherError) {
      console.error("Error triggering Pusher event:", pusherError)
      // Continue execution even if Pusher fails
    }

    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error resetting games:", error)
    return { success: false, error: "Failed to reset games" }
  }
}

// Add a new function to reset a single game
// Reset a single game
export async function resetSingleGame(gameId: string) {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Reset the specific game state
    const { error: gameError } = await supabaseAdmin
      .from("games")
      .update({
        current_question_id: null,
        status: "waiting",
      })
      .eq("id", gameId)

    if (gameError) throw gameError

    // Get all questions for this game
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("game_id", gameId)

    if (questionsError) throw questionsError

    if (questions && questions.length > 0) {
      const questionIds = questions.map((q) => q.id)

      // Delete answers for these questions
      for (const questionId of questionIds) {
        const { data: answers, error: answersError } = await supabaseAdmin
          .from("answers")
          .select("id")
          .eq("question_id", questionId)

        if (answersError) {
          console.error(`Error fetching answers for question ${questionId}:`, answersError)
          continue
        }

        if (answers && answers.length > 0) {
          for (const answer of answers) {
            const { error: deleteError } = await supabaseAdmin.from("answers").delete().eq("id", answer.id)

            if (deleteError) {
              console.error(`Error deleting answer ${answer.id}:`, deleteError)
            }
          }
        }

        // Delete custom answers for this question
        const { error: customAnswersError } = await supabaseAdmin
          .from("answer_options")
          .delete()
          .eq("question_id", questionId)
          .eq("is_custom", true)

        if (customAnswersError) {
          console.error(`Error deleting custom answers for question ${questionId}:`, customAnswersError)
        }
      }
    }

    // If this is the active game, trigger a game reset event
    const { data: game, error: gameCheckError } = await supabaseAdmin
      .from("games")
      .select("is_active")
      .eq("id", gameId)
      .single()

    if (!gameCheckError && game && game.is_active) {
      try {
        await pusherServer.trigger(GAME_CHANNEL, EVENTS.GAME_RESET, {})
      } catch (pusherError) {
        console.error("Error triggering Pusher event:", pusherError)
      }
    }

    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error resetting game:", error)
    return { success: false, error: "Failed to reset game" }
  }
}

// Reset all votes without resetting the entire game
export async function resetVotes() {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Get all answers first
    const { data: allAnswers, error: fetchError } = await supabaseAdmin.from("answers").select("id")

    if (fetchError) throw fetchError

    // If there are answers, delete them in batches or one by one
    if (allAnswers && allAnswers.length > 0) {
      console.log(`Deleting ${allAnswers.length} votes...`)

      // Delete answers one by one to avoid UUID syntax issues
      for (const answer of allAnswers) {
        const { error: deleteError } = await supabaseAdmin.from("answers").delete().eq("id", answer.id)

        if (deleteError) {
          console.error(`Error deleting answer ${answer.id}:`, deleteError)
          // Continue with other deletions even if one fails
        }
      }
    }

    // Clear all custom answers (stored in answer_options with is_custom=true)
    const { error: customAnswersError } = await supabaseAdmin.from("answer_options").delete().eq("is_custom", true)

    if (customAnswersError) {
      console.error("Error deleting custom answers:", customAnswersError)
      // Continue even if custom answer deletion fails
    }

    // Trigger Pusher event to notify all clients about vote updates
    try {
      // For each active question, broadcast an empty vote count
      const { data: activeGame } = await supabaseAdmin
        .from("games")
        .select("current_question_id")
        .eq("is_active", true)
        .single()

      if (activeGame?.current_question_id) {
        await pusherServer.trigger(GAME_CHANNEL, EVENTS.VOTE_UPDATE, {
          voteCounts: {},
          totalVotes: 0,
          questionId: activeGame.current_question_id,
          timestamp: new Date().toISOString(),
          source: "resetVotes",
        })
      }
    } catch (pusherError) {
      console.error("Error triggering Pusher event:", pusherError)
      // Continue execution even if Pusher fails
    }

    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error resetting votes:", error)
    return { success: false, error: "Failed to reset votes" }
  }
}

// Upload a new question
export async function uploadQuestion(formData: FormData) {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    console.log("[SERVER] uploadQuestion: Unauthorized - no admin token")
    return { success: false, error: "Unauthorized" }
  }

  try {
    console.log("[SERVER] uploadQuestion: Starting question upload process")

    // Get the question type from the form data
    const questionType = formData.get("type") as "baby-picture" | "text"
    console.log(`[SERVER] uploadQuestion: Question type: ${questionType}`)

    if (!questionType) {
      console.log("[SERVER] uploadQuestion: Missing question type")
      return { success: false, error: "Question type is required" }
    }

    const questionText = formData.get("question") as string
    console.log(
      `[SERVER] uploadQuestion: Question text: ${questionText?.substring(0, 50)}${questionText?.length > 50 ? "..." : ""}`,
    )

    if (!questionText) {
      console.log("[SERVER] uploadQuestion: Missing question text")
      return { success: false, error: "Question text is required" }
    }

    // Get the game ID
    const gameId = formData.get("game_id") as string
    console.log(`[SERVER] uploadQuestion: Game ID: ${gameId}`)

    if (!gameId) {
      console.log("[SERVER] uploadQuestion: Missing game ID")
      return { success: false, error: "Game selection is required" }
    }

    // Check if the game exists
    const { data: game, error: gameError } = await supabaseAdmin.from("games").select("id").eq("id", gameId).single()
    console.log(
      `[SERVER] uploadQuestion: Game check result: ${game ? "found" : "not found"}, error: ${gameError ? gameError.message : "none"}`,
    )

    if (gameError || !game) {
      console.log("[SERVER] uploadQuestion: Game not found")
      return { success: false, error: "Selected game not found" }
    }

    // Check if this is a question with no prefilled options
    const noPrefilledOptions = formData.get("no_prefilled_options") === "true"
    console.log(`[SERVER] uploadQuestion: No prefilled options: ${noPrefilledOptions}`)

    // Get options
    const options: string[] = []
    let correctAnswerIndex = Number.parseInt(formData.get("correctAnswerIndex") as string) || 0
    const noCorrectAnswer = formData.get("no_correct_answer") === "true"
    console.log(
      `[SERVER] uploadQuestion: No correct answer: ${noCorrectAnswer}, Correct answer index: ${correctAnswerIndex}`,
    )

    // Only collect options if we're not using the "no prefilled options" mode
    if (!noPrefilledOptions) {
      // Log all form data keys for debugging
      console.log("[SERVER] uploadQuestion: Form data keys:", Array.from(formData.keys()))

      for (let i = 0; i < 10; i++) {
        const option = formData.get(`option_${i}`)
        if (option && (option as string).trim()) {
          options.push((option as string).trim())
          console.log(`[SERVER] uploadQuestion: Added option ${i}: "${(option as string).trim()}"`)
        }
      }

      console.log(`[SERVER] uploadQuestion: Total options collected: ${options.length}`)

      // Validate options unless we're in "no prefilled options" mode
      if (options.length < 2 && !noPrefilledOptions) {
        console.log("[SERVER] uploadQuestion: Not enough options")
        return { success: false, error: "At least 2 options are required" }
      }

      if (correctAnswerIndex >= options.length) {
        console.log(
          `[SERVER] uploadQuestion: Correct answer index ${correctAnswerIndex} is out of bounds, resetting to 0`,
        )
        correctAnswerIndex = 0
      }
    }

    // Make sure custom answers are enabled if there are no prefilled options
    const allowsCustomAnswers = formData.get("allows_custom_answers") !== "false"
    console.log(`[SERVER] uploadQuestion: Allows custom answers: ${allowsCustomAnswers}`)

    if (noPrefilledOptions && !allowsCustomAnswers) {
      console.log("[SERVER] uploadQuestion: Custom answers must be enabled with no prefilled options")
      return { success: false, error: "Custom answers must be enabled when using no prefilled options" }
    }

    let imageUrl = undefined

    // Handle image upload for baby picture questions
    if (questionType === "baby-picture") {
      console.log("[SERVER] uploadQuestion: Processing baby picture upload")
      const image = formData.get("image") as File

      if (!image) {
        console.log("[SERVER] uploadQuestion: No image file found in form data")
        return { success: false, error: "Image is required for baby picture questions" }
      }

      console.log(`[SERVER] uploadQuestion: Image file: ${image.name}, size: ${image.size}, type: ${image.type}`)

      if (image.size === 0) {
        console.log("[SERVER] uploadQuestion: Image file has zero size")
        return { success: false, error: "Image is required for baby picture questions" }
      }

      // Check if the bucket exists and create it if it doesn't
      console.log("[SERVER] uploadQuestion: Checking if storage bucket exists")
      const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()

      if (bucketsError) {
        console.log(`[SERVER] uploadQuestion: Error listing buckets: ${bucketsError.message}`)
      }

      console.log(`[SERVER] uploadQuestion: Found ${buckets?.length || 0} buckets`)
      const bucketExists = buckets?.some((bucket) => bucket.name === "baby-pictures")
      console.log(`[SERVER] uploadQuestion: baby-pictures bucket exists: ${bucketExists}`)

      if (!bucketExists) {
        // Create the bucket
        console.log("[SERVER] uploadQuestion: Creating baby-pictures bucket")
        const { error: createBucketError } = await supabaseAdmin.storage.createBucket("baby-pictures", {
          public: false, // Private bucket for secure access
        })

        if (createBucketError) {
          console.error("[SERVER] uploadQuestion: Error creating bucket:", createBucketError)
          return {
            success: false,
            error:
              "Failed to create storage bucket. Please contact the administrator to set up the storage bucket in Supabase.",
          }
        }
        console.log("[SERVER] uploadQuestion: Successfully created baby-pictures bucket")
      }

      // Upload image to Supabase Storage
      const fileName = `${generateId()}-${image.name.replace(/\s+/g, "-").toLowerCase()}`
      console.log(`[SERVER] uploadQuestion: Generated file name: ${fileName}`)

      console.log("[SERVER] uploadQuestion: Starting image upload to Supabase")
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("baby-pictures")
        .upload(fileName, image, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.error("[SERVER] uploadQuestion: Error uploading image:", uploadError)
        return { success: false, error: `Failed to upload image: ${uploadError.message}` }
      }

      console.log(`[SERVER] uploadQuestion: Image uploaded successfully: ${uploadData?.path}`)

      // Instead of getting a public URL, we'll store just the file path
      // We'll generate signed URLs when needed
      imageUrl = `baby-pictures/${fileName}`
      console.log(`[SERVER] uploadQuestion: Image URL set to: ${imageUrl}`)
    }

    // Insert the question into the database with a proper UUID
    const questionId = generateUUID()
    console.log(`[SERVER] uploadQuestion: Generated question ID: ${questionId}`)

    // Use a special placeholder value instead of null for questions with no correct answer
    // This is needed because the database schema has a NOT NULL constraint on correct_answer
    const correctAnswer =
      noCorrectAnswer || noPrefilledOptions
        ? options.length > 0
          ? options[0]
          : "NONE" // Use first option or "NONE" as placeholder
        : options[correctAnswerIndex]

    console.log(
      `[SERVER] uploadQuestion: Correct answer: ${correctAnswer} (${noCorrectAnswer || noPrefilledOptions ? "placeholder - no actual correct answer" : "actual correct answer"})`,
    )

    // Add a flag to indicate if this question has no correct answer
    const hasNoCorrectAnswer = noCorrectAnswer || noPrefilledOptions

    console.log("[SERVER] uploadQuestion: Inserting question into database")
    const { error, data } = await supabaseAdmin
      .from("questions")
      .insert({
        id: questionId,
        type: questionType,
        question: questionText,
        image_url: imageUrl,
        options: options,
        correct_answer: correctAnswer, // This will never be null now
        allows_custom_answers: allowsCustomAnswers,
        no_correct_answer: hasNoCorrectAnswer, // Add this flag to indicate if there's no correct answer
        game_id: gameId, // Associate with the selected game
      })
      .select()

    if (error) {
      console.error("[SERVER] uploadQuestion: Database error:", error)
      throw error
    }

    console.log(`[SERVER] uploadQuestion: Question inserted successfully: ${data?.[0]?.id}`)
    revalidatePath("/admin/dashboard")

    return { success: true, gameId }
  } catch (error) {
    console.error("[SERVER] uploadQuestion: Error adding question:", error)
    return { success: false, error: "Failed to add question" }
  }
}

// Delete a question
export async function deleteQuestion(id: string) {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Get the question to check if it has an image
    const { data: question, error: getError } = await supabaseAdmin
      .from("questions")
      .select("image_url, game_id")
      .eq("id", id)
      .single()

    if (getError) throw getError

    // Delete the image from storage if it exists
    if (question.image_url) {
      const fileName = question.image_url.split("/").pop()

      if (fileName) {
        const { error: storageError } = await supabaseAdmin.storage.from("baby-pictures").remove([fileName])

        if (storageError) {
          console.error("Error deleting image:", storageError)
          // Continue with question deletion even if image deletion fails
        }
      }
    }

    // Delete the question
    const { error } = await supabaseAdmin.from("questions").delete().eq("id", id)

    if (error) throw error

    // Delete any answers for this question
    const { error: answersError } = await supabaseAdmin.from("answers").delete().eq("question_id", id)

    if (answersError) {
      console.error("Error deleting answers:", answersError)
      // Continue even if answer deletion fails
    }

    // Delete any custom answers for this question (stored in answer_options with is_custom=true)
    const { error: customAnswersError } = await supabaseAdmin
      .from("answer_options")
      .delete()
      .eq("question_id", id)
      .eq("is_custom", true)

    if (customAnswersError) {
      console.error("Error deleting custom answers:", customAnswersError)
      // Continue even if custom answer deletion fails
    }

    // Check if this was the current question in the active game and update game state if needed
    const { data: activeGame, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id, current_question_id")
      .eq("is_active", true)
      .single()

    if (!gameError && activeGame && activeGame.current_question_id === id) {
      // This was the current question, set to null
      await supabaseAdmin.from("games").update({ current_question_id: null }).eq("id", activeGame.id)
    }

    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error deleting question:", error)
    return { success: false, error: "Failed to delete question" }
  }
}

// Set a specific question as active
export async function setActiveQuestion(questionId: string) {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Get the active game
    const { data: activeGame, error: activeGameError } = await supabaseAdmin
      .from("games")
      .select("id")
      .eq("is_active", true)
      .single()

    if (activeGameError || !activeGame) {
      return { success: false, error: "No active game found" }
    }

    // Update the active game with the specified question
    const { error: updateError } = await supabaseAdmin
      .from("games")
      .update({
        current_question_id: questionId,
        status: "active", // Ensure status is set to active
      })
      .eq("id", activeGame.id)

    if (updateError) throw updateError

    // Log the state after updates for debugging
    console.log("[SERVER] Question set as active:", {
      questionId,
      activeGameId: activeGame.id,
    })

    // Get the full question details to send to clients
    const { data: questionDetails, error: detailsError } = await supabaseAdmin
      .from("questions")
      .select("id, type, question, image_url, options, allows_custom_answers")
      .eq("id", questionId)
      .single()

    if (detailsError) throw detailsError

    // When moving to a new question, we need to pre-populate the answer_options table
    // with the predefined options from the question
    await populateAnswerOptions(questionDetails.id, questionDetails.options)

    // Trigger Pusher event to notify all clients
    try {
      console.log("[SERVER] Triggering QUESTION_UPDATE event via Pusher for question:", questionDetails.id)

      // Add a timestamp to ensure clients recognize this as a new event
      const eventData = {
        question: {
          id: questionDetails.id,
          type: questionDetails.type,
          question: questionDetails.question,
          imageUrl: questionDetails.image_url,
          options: questionDetails.options,
          allowsCustomAnswers: questionDetails.allows_custom_answers,
        },
        timestamp: Date.now(),
      }

      await pusherServer.trigger(GAME_CHANNEL, EVENTS.QUESTION_UPDATE, eventData)
      console.log("[SERVER] Successfully triggered QUESTION_UPDATE event")
    } catch (pusherError) {
      console.error("Error triggering Pusher event:", pusherError)
      // Continue execution even if Pusher fails
    }

    return { success: true }
  } catch (error) {
    console.error("Error setting active question:", error)
    return { success: false, error: "Failed to set active question" }
  }
}

// Add these new server actions to the existing actions.ts file

// Create a new game
export async function createGame({ name, description }: { name: string; description?: string }) {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Generate a unique ID for the game (using a prefix to make it clear it's not a UUID)
    const gameId = `game_${generateId(16)}`

    // Insert the new game
    const { error } = await supabaseAdmin.from("games").insert({
      id: gameId,
      name,
      description: description || null,
      status: "waiting",
      is_active: false,
    })

    if (error) throw error

    return { success: true, gameId }
  } catch (error) {
    console.error("Error creating game:", error)
    return { success: false, error: "Failed to create game" }
  }
}

// Set a game as active
export async function setActiveGame(gameId: string) {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // First, set all games to inactive
    const { error: updateError } = await supabaseAdmin.from("games").update({ is_active: false }).neq("id", "none")

    if (updateError) throw updateError

    // Then, set the selected game to active
    const { error } = await supabaseAdmin.from("games").update({ is_active: true }).eq("id", gameId)

    if (error) throw error

    // Trigger Pusher event to notify all clients about the game change
    try {
      await pusherServer.trigger(GAME_CHANNEL, EVENTS.GAME_CHANGE, {
        gameId,
        timestamp: Date.now(),
      })
    } catch (pusherError) {
      console.error("Error triggering Pusher event:", pusherError)
      // Continue execution even if Pusher fails
    }

    return { success: true }
  } catch (error) {
    console.error("Error setting active game:", error)
    return { success: false, error: "Failed to set active game" }
  }
}

// Delete a game
export async function deleteGame(gameId: string) {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Check if the game is active
    const { data: game, error: checkError } = await supabaseAdmin
      .from("games")
      .select("is_active")
      .eq("id", gameId)
      .single()

    if (checkError) throw checkError

    if (game.is_active) {
      return { success: false, error: "Cannot delete an active game" }
    }

    // Get all questions for this game
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("game_id", gameId)

    if (questionsError) throw questionsError

    // Delete all answers for questions in this game
    if (questions && questions.length > 0) {
      const questionIds = questions.map((q) => q.id)

      // Delete answers for these questions
      const { error: answersError } = await supabaseAdmin.from("answers").delete().in("question_id", questionIds)

      if (answersError) {
        console.error("Error deleting answers:", answersError)
        // Continue with deletion even if this fails
      }

      // Delete answer options for these questions
      const { error: optionsError } = await supabaseAdmin.from("answer_options").delete().in("question_id", questionIds)

      if (optionsError) {
        console.error("Error deleting answer options:", optionsError)
        // Continue with deletion even if this fails
      }

      // Delete questions
      const { error: deleteQuestionsError } = await supabaseAdmin.from("questions").delete().eq("game_id", gameId)

      if (deleteQuestionsError) throw deleteQuestionsError
    }

    // Finally, delete the game
    const { error } = await supabaseAdmin.from("games").delete().eq("id", gameId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error deleting game:", error)
    return { success: false, error: "Failed to delete game" }
  }
}
