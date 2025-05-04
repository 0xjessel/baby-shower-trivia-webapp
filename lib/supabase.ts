import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Generate a signed URL for a private file in Supabase Storage
export async function getSignedUrl(path: string): Promise<string> {
  if (!path) return ""

  // Extract bucket and file path from the stored path
  // Format could be either "baby-pictures/filename.jpg" or a full URL
  let bucket = "baby-pictures"
  let filePath = path

  if (path.includes("://")) {
    // It's a full URL, extract the filename
    filePath = path.split("/").pop() || ""
  } else if (path.includes("/")) {
    // It's in format "bucket/filename"
    const parts = path.split("/")
    bucket = parts[0]
    filePath = parts.slice(1).join("/")
  }

  try {
    // Generate a signed URL that expires in 24 hours (changed from 1 hour)
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(filePath, 60 * 60 * 24) // 24 hour expiry

    if (error) {
      console.error("Error generating signed URL:", error)
      return ""
    }

    return data.signedUrl
  } catch (error) {
    console.error("Error generating signed URL:", error)
    return ""
  }
}
