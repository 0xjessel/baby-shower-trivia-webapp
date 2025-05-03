import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for browser usage (limited permissions)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with admin privileges
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Types for our database tables
export type Question = {
  id: string
  type: "baby-picture" | "text"
  question: string
  image_url?: string
  options: string[]
  correct_answer: string
  created_at: string
}

export type Participant = {
  id: string
  name: string
  created_at: string
}

export type Answer = {
  id: string
  participant_id: string
  question_id: string
  answer: string
  is_correct: boolean
  created_at: string
}

export type Game = {
  id: string
  current_question_id: string | null
  status: "waiting" | "active" | "results"
  created_at: string
}
