"use server"

import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase"
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
