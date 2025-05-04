"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { supabaseAdmin } from "@/lib/supabase"
import { pusherServer, GAME_CHANNEL, EVENTS } from "@/lib/pusher-server"
import { generateId, generateUUID } from "@/lib/utils"
import { populateAnswerOptions } from "./utils"

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
