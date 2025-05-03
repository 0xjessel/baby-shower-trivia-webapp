"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { supabaseAdmin } from "@/lib/supabase"
import { pusherServer, GAME_CHANNEL, EVENTS } from "@/lib/pusher-server"

// Admin password - in a real app, store this securely
const ADMIN_PASSWORD = "babyshower2023"

// Join game as a participant
export async function joinGame(name: string) {
  try {
    // Create a new participant
    const participantId = uuidv4()

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
    const adminToken = uuidv4()

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

// Submit answer for a question
export async function submitAnswer(questionId: string, answer: string) {
  const participantId = cookies().get("participantId")?.value

  if (!participantId) {
    redirect("/join")
  }

  try {
    // Get the correct answer for this question
    const { data: question, error: questionError } = await supabaseAdmin
      .from("questions")
      .select("correct_answer")
      .eq("id", questionId)
      .single()

    if (questionError) throw questionError

    const isCorrect = question.correct_answer === answer

    // Check if the participant has already answered this question
    const { data: existingAnswer, error: checkError } = await supabaseAdmin
      .from("answers")
      .select("id")
      .eq("participant_id", participantId)
      .eq("question_id", questionId)
      .maybeSingle()

    if (checkError) throw checkError

    if (existingAnswer) {
      // Update existing answer
      const { error: updateError } = await supabaseAdmin
        .from("answers")
        .update({
          answer: answer,
          is_correct: isCorrect,
        })
        .eq("id", existingAnswer.id)

      if (updateError) throw updateError
    } else {
      // Insert new answer
      const { error: insertError } = await supabaseAdmin.from("answers").insert({
        participant_id: participantId,
        question_id: questionId,
        answer: answer,
        is_correct: isCorrect,
      })

      if (insertError) throw insertError
    }

    return { success: true }
  } catch (error) {
    console.error("Error submitting answer:", error)
    return { success: false, error: "Failed to submit answer" }
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
    // Get all questions
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("questions")
      .select("id")
      .order("created_at", { ascending: true })

    if (questionsError) throw questionsError

    if (questions.length === 0) {
      return { success: false, error: "No questions available" }
    }

    // Get current game state
    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("id", "current")
      .maybeSingle()

    if (gameError) throw gameError

    let currentIndex = 0

    if (game) {
      if (game.current_question_id) {
        // Find the index of the current question
        const currentQuestionIndex = questions.findIndex((q) => q.id === game.current_question_id)
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
        .eq("id", "current")

      if (updateError) throw updateError
    } else {
      // Create a new game
      const { error: insertError } = await supabaseAdmin.from("games").insert({
        id: "current",
        current_question_id: questions[0].id,
        status: "active",
      })

      if (insertError) throw insertError
    }

    // Get the full question details to send to clients
    const { data: questionDetails, error: detailsError } = await supabaseAdmin
      .from("questions")
      .select("id, type, question, image_url, options")
      .eq("id", questions[currentIndex].id)
      .single()

    if (detailsError) throw detailsError

    // Trigger Pusher event to notify all clients
    await pusherServer.trigger(GAME_CHANNEL, EVENTS.QUESTION_UPDATE, {
      question: {
        id: questionDetails.id,
        type: questionDetails.type,
        question: questionDetails.question,
        imageUrl: questionDetails.image_url,
        options: questionDetails.options,
      },
    })

    return { success: true }
  } catch (error) {
    console.error("Error advancing to next question:", error)
    return { success: false, error: "Failed to advance to next question" }
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
    // Update game status to show results
    const { error } = await supabaseAdmin.from("games").update({ status: "results" }).eq("id", "current")

    if (error) throw error

    // Trigger Pusher event to notify all clients
    await pusherServer.trigger(GAME_CHANNEL, EVENTS.SHOW_RESULTS, {})

    return { success: true }
  } catch (error) {
    console.error("Error showing results:", error)
    return { success: false, error: "Failed to show results" }
  }
}

// Reset the game
export async function resetGame() {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Reset game state
    const { error: gameError } = await supabaseAdmin
      .from("games")
      .update({
        current_question_id: null,
        status: "waiting",
      })
      .eq("id", "current")

    if (gameError) throw gameError

    // Clear all answers
    const { error: answersError } = await supabaseAdmin.from("answers").delete().neq("id", "0") // Delete all answers

    if (answersError) throw answersError

    // Trigger Pusher event to notify all clients
    await pusherServer.trigger(GAME_CHANNEL, EVENTS.GAME_RESET, {})

    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error resetting game:", error)
    return { success: false, error: "Failed to reset game" }
  }
}

// Upload a new question
export async function uploadQuestion(formData: FormData) {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const questionType = formData.get("question-type") as "baby-picture" | "text"
    const questionText = formData.get("question") as string

    if (!questionText) {
      return { success: false, error: "Question text is required" }
    }

    // Get options
    const options: string[] = []
    let correctAnswerIndex = Number.parseInt(formData.get("correctAnswerIndex") as string) || 0

    for (let i = 0; i < 10; i++) {
      const option = formData.get(`option_${i}`)
      if (option) {
        options.push(option as string)
      }
    }

    if (options.length < 2) {
      return { success: false, error: "At least 2 options are required" }
    }

    if (correctAnswerIndex >= options.length) {
      correctAnswerIndex = 0
    }

    let imageUrl = undefined

    // Handle image upload for baby picture questions
    if (questionType === "baby-picture") {
      const image = formData.get("image") as File

      if (!image || image.size === 0) {
        return { success: false, error: "Image is required for baby picture questions" }
      }

      // Upload image to Supabase Storage
      const fileName = `${uuidv4()}-${image.name.replace(/\s+/g, "-").toLowerCase()}`

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("baby-pictures")
        .upload(fileName, image, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Get public URL for the uploaded image
      const { data: urlData } = supabaseAdmin.storage.from("baby-pictures").getPublicUrl(fileName)

      imageUrl = urlData.publicUrl
    }

    // Insert the question into the database
    const questionId = uuidv4()

    const { error } = await supabaseAdmin.from("questions").insert({
      id: questionId,
      type: questionType,
      question: questionText,
      image_url: imageUrl,
      options: options,
      correct_answer: options[correctAnswerIndex],
    })

    if (error) throw error

    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error adding question:", error)
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
      .select("image_url")
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

    // Check if this was the current question and update game state if needed
    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .select("current_question_id")
      .eq("id", "current")
      .maybeSingle()

    if (!gameError && game && game.current_question_id === id) {
      // This was the current question, set to null
      await supabaseAdmin.from("games").update({ current_question_id: null }).eq("id", "current")
    }

    revalidatePath("/admin/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error deleting question:", error)
    return { success: false, error: "Failed to delete question" }
  }
}
