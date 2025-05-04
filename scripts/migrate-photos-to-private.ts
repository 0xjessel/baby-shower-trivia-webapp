import { createClient } from "@supabase/supabase-js"

// Replace these with your actual Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function migratePhotosToPrivate() {
  console.log("Starting migration of photos to private bucket...")

  try {
    // 1. Check if the bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

    if (bucketsError) {
      throw bucketsError
    }

    const babyPicturesBucket = buckets?.find((bucket) => bucket.name === "baby-pictures")

    if (!babyPicturesBucket) {
      console.log("No baby-pictures bucket found. Nothing to migrate.")
      return
    }

    // 2. Update the bucket to be private
    console.log("Updating baby-pictures bucket to private...")
    const { error: updateError } = await supabase.storage.updateBucket("baby-pictures", {
      public: false,
    })

    if (updateError) {
      throw updateError
    }

    console.log("Successfully updated bucket to private!")

    // 3. List all files in the bucket to verify
    const { data: files, error: filesError } = await supabase.storage.from("baby-pictures").list()

    if (filesError) {
      throw filesError
    }

    console.log(`Found ${files?.length || 0} files in the bucket:`)
    files?.forEach((file) => {
      console.log(`- ${file.name}`)
    })

    // 4. Update database records to use the new format if needed
    console.log("Checking database records...")
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("id, image_url")
      .not("image_url", "is", null)

    if (questionsError) {
      throw questionsError
    }

    console.log(`Found ${questions?.length || 0} questions with images`)

    // Check if any URLs need to be updated to the new format
    const questionsToUpdate = questions?.filter(
      (q) => q.image_url && q.image_url.includes("://") && !q.image_url.startsWith("baby-pictures/"),
    )

    if (questionsToUpdate && questionsToUpdate.length > 0) {
      console.log(`Updating ${questionsToUpdate.length} questions with new image URL format...`)

      for (const question of questionsToUpdate) {
        // Extract filename from URL
        const filename = question.image_url.split("/").pop()
        const newImageUrl = `baby-pictures/${filename}`

        const { error: updateQuestionError } = await supabase
          .from("questions")
          .update({ image_url: newImageUrl })
          .eq("id", question.id)

        if (updateQuestionError) {
          console.error(`Error updating question ${question.id}:`, updateQuestionError)
        } else {
          console.log(`Updated question ${question.id} image URL to: ${newImageUrl}`)
        }
      }
    } else {
      console.log("No questions need URL format updates")
    }

    console.log("Migration completed successfully!")
  } catch (error) {
    console.error("Migration failed:", error)
  }
}

// Run the migration
migratePhotosToPrivate()
