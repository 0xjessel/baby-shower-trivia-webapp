"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { supabaseAdmin } from "@/lib/supabase"
import { pusherServer, GAME_CHANNEL, EVENTS } from "@/lib/pusher-server"
import { generateUUID } from "@/lib/utils"
import { getVoteCounts } from "./utils"

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
        // Don't include vote counts here - we'll send a separate VOTE_UPDATE event
      })

      // Send a separate vote update event with a slight delay to avoid race conditions
      setTimeout(async () => {
        try {
          await pusherServer.trigger(GAME_CHANNEL, EVENTS.VOTE_UPDATE, {
            voteCounts: voteData.voteCounts,
            totalVotes: voteData.totalVotes,
            questionId: questionId,
            timestamp: new Date().toISOString(),
            source: "customAnswer",
          })
        } catch (voteUpdateError) {
          console.error("[SERVER] Error triggering vote update after custom answer:", voteUpdateError)
        }
      }, 100)

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
