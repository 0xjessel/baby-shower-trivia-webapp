"use server"

import { revalidatePath } from "next/cache"
import { supabaseAdmin } from "@/lib/supabase"
import { pusherServer } from "@/lib/pusher-server"
import { populateAnswerOptions } from "./utils"
import { cookies } from "next/headers"
import { checkAdminAuth } from "./utils"
import { GAME_CHANNEL, EVENTS } from "@/lib/pusher-server"

// Upload a new question
export async function uploadQuestion(formData: FormData) {
  try {
    // Check if user is authenticated as admin
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return { success: false, error: "Unauthorized" }
    }

    // Extract form data
    const question = formData.get("question") as string
    const type = formData.get("type") as "text" | "baby-picture"
    const optionsJson = formData.get("options") as string
    const options = JSON.parse(optionsJson)
    const correctAnswer = formData.get("correctAnswer") as string
    const noCorrectAnswer = formData.get("noCorrectAnswer") === "true"
    const allowsCustomAnswers = formData.get("allowsCustomAnswers") === "true"
    const isOpinionQuestion = formData.get("isOpinionQuestion") === "true"
    const image = formData.get("image") as File

    // Debug log for all received form data
    console.log("[DEBUG] Received formData in uploadQuestion:", {
      question,
      type,
      options,
      correctAnswer,
      noCorrectAnswer,
      allowsCustomAnswers,
      isOpinionQuestion,
      image,
      imageType: image?.type,
      imageSize: image?.size,
      imageName: image?.name,
      imageInstanceOfFile: image instanceof File,
      typeofImage: typeof image
    })

    // Validate inputs
    if (!question || !type || !options || options.length < 2) {
      return { success: false, error: "Invalid input data" }
    }

    // Handle image upload if present
    let imageUrl = null
    if (image && image.size > 0) {
      const fileExt = image.name.split(".").pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `baby-pictures/${fileName}`

      const { error: uploadError } = await supabaseAdmin.storage.from("game-assets").upload(filePath, image)

      if (uploadError) {
        console.error("Error uploading image:", uploadError)
        return { success: false, error: "Failed to upload image" }
      }

      imageUrl = filePath
    }

    // Insert question into database
    const { data: questionData, error: questionError } = await supabaseAdmin
      .from("questions")
      .insert({
        type,
        question,
        image_url: imageUrl,
        options,
        correct_answer: noCorrectAnswer ? "NONE" : correctAnswer,
        no_correct_answer: noCorrectAnswer,
        allows_custom_answers: allowsCustomAnswers,
        is_opinion_question: isOpinionQuestion,
      })
      .select()
      .single()

    if (questionError) {
      console.error("Error inserting question:", questionError)
      return { success: false, error: "Failed to save question" }
    }

    // Revalidate the questions page
    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error uploading question:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

// Delete a question
export async function deleteQuestion(questionId: string) {
  try {
    // Check if user is authenticated as admin
    const isAdmin = await checkAdminAuth()
    if (!isAdmin) {
      return { success: false, error: "Unauthorized" }
    }

    // First, delete any custom answers associated with this question
    const { error: customAnswersError } = await supabaseAdmin
      .from("answer_options")
      .delete()
      .eq("question_id", questionId)
      .eq("is_custom", true)

    if (customAnswersError) {
      console.error("Error deleting custom answers:", customAnswersError)
      return { success: false, error: "Failed to delete custom answers" }
    }

    // Then delete the question
    const { error } = await supabaseAdmin.from("questions").delete().eq("id", questionId)

    if (error) {
      console.error("Error deleting question:", error)
      return { success: false, error: "Failed to delete question" }
    }

    // Revalidate the questions page
    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error deleting question:", error)
    return { success: false, error: "An unexpected error occurred" }
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
    // First, trigger a loading event to show spinners on client devices
    await pusherServer.trigger(GAME_CHANNEL, "loading-question", {
      timestamp: Date.now(),
    })

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
      .select("id, type, question, image_url, options, allows_custom_answers, no_correct_answer")
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
          isOpinionQuestion: questionDetails.no_correct_answer || false,
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

// Move to next question
export async function nextQuestion() {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // First, trigger a loading event to show spinners on client devices
    await pusherServer.trigger(GAME_CHANNEL, "loading-question", {
      timestamp: Date.now(),
    })

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
      .select("id, type, question, image_url, options, allows_custom_answers, no_correct_answer")
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
          isOpinionQuestion: questionDetails.no_correct_answer || false,
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
    // First, trigger a loading event to show spinners on client devices
    await pusherServer.trigger(GAME_CHANNEL, "loading-question", {
      timestamp: Date.now(),
    })

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
      .select("id, type, question, image_url, options, allows_custom_answers, no_correct_answer")
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
          isOpinionQuestion: questionDetails.no_correct_answer || false,
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
      await pusherServer.trigger(GAME_CHANNEL, EVENTS.SHOW_RESULTS, {})
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
