"use server"

import { supabaseAdmin } from "@/lib/supabase"

// Helper function to get vote counts
export async function getVoteCounts(questionId: string) {
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
export async function populateAnswerOptions(questionId: string, options: string[]) {
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

// Import the generateUUID function from utils
import { generateUUID } from "@/lib/utils"
