import { createClient as supabaseCreateClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Add debug logs for Supabase initialization
console.log(`[SUPABASE] Initializing Supabase client with URL: ${supabaseUrl ? "provided" : "missing"}`)
console.log(`[SUPABASE] Service role key: ${supabaseKey ? "provided" : "missing"}`)

export const supabaseAdmin = supabaseCreateClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Generate a signed URL for a private file in Supabase Storage
export async function getSignedUrl(path: string): Promise<string> {
  console.log(`[SUPABASE] getSignedUrl called for path: ${path}`)

  if (!path) {
    console.log(`[SUPABASE] getSignedUrl: Empty path provided, returning empty string`)
    return ""
  }

  // Extract bucket and file path from the stored path
  // Format could be either "baby-pictures/filename.jpg" or a full URL
  let bucket = "baby-pictures"
  let filePath = path

  if (path.includes("://")) {
    // It's a full URL, extract the filename
    filePath = path.split("/").pop() || ""
    console.log(`[SUPABASE] getSignedUrl: Extracted filename from URL: ${filePath}`)
  } else if (path.includes("/")) {
    // It's in format "bucket/filename"
    const parts = path.split("/")
    bucket = parts[0]
    filePath = parts.slice(1).join("/")
    console.log(`[SUPABASE] getSignedUrl: Extracted bucket: ${bucket}, filePath: ${filePath}`)
  }

  try {
    console.log(`[SUPABASE] getSignedUrl: Generating signed URL for bucket: ${bucket}, file: ${filePath}`)
    // Generate a signed URL that expires in 24 hours (changed from 1 hour)
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(filePath, 60 * 60 * 24) // 24 hour expiry

    if (error) {
      console.error(`[SUPABASE] getSignedUrl: Error generating signed URL:`, error)
      return ""
    }

    console.log(`[SUPABASE] getSignedUrl: Successfully generated signed URL (expires in 24h)`)
    return data.signedUrl
  } catch (error) {
    console.error(`[SUPABASE] getSignedUrl: Exception generating signed URL:`, error)
    return ""
  }
}

export const createClient = supabaseCreateClient
