"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

// Migrate from the legacy "current" game to the new active game system
export async function migrateToGameSystem() {
  // Check if admin
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Migration logic would go here
    // This is just a placeholder since the original file wasn't included in the code snippets

    revalidatePath("/admin/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Error during migration:", error)
    return {
      success: false,
      error: "Failed to migrate game system",
    }
  }
}
