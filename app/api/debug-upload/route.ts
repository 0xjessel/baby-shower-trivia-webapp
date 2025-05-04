export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase"
import { generateId } from "@/lib/utils"

export async function POST(request: Request) {
  // Check if admin is authenticated
  const adminToken = cookies().get("adminToken")?.value
  if (!adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const image = formData.get("image") as File

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    console.log(`[DEBUG-UPLOAD] Image file: ${image.name}, size: ${image.size}, type: ${image.type}`)

    // Check if the bucket exists and create it if it doesn't
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()

    if (bucketsError) {
      console.error("[DEBUG-UPLOAD] Error listing buckets:", bucketsError)
      return NextResponse.json({ error: `Error listing buckets: ${bucketsError.message}` }, { status: 500 })
    }

    const bucketExists = buckets?.some((bucket) => bucket.name === "baby-pictures")
    console.log(`[DEBUG-UPLOAD] baby-pictures bucket exists: ${bucketExists}`)

    if (!bucketExists) {
      console.log("[DEBUG-UPLOAD] Creating baby-pictures bucket")
      const { error: createBucketError } = await supabaseAdmin.storage.createBucket("baby-pictures", {
        public: false,
      })

      if (createBucketError) {
        console.error("[DEBUG-UPLOAD] Error creating bucket:", createBucketError)
        return NextResponse.json({ error: `Error creating bucket: ${createBucketError.message}` }, { status: 500 })
      }

      console.log("[DEBUG-UPLOAD] Successfully created baby-pictures bucket")
    }

    // Upload test image
    const fileName = `debug-test-${generateId()}.png`
    console.log(`[DEBUG-UPLOAD] Uploading test image as: ${fileName}`)

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("baby-pictures")
      .upload(fileName, image, {
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      console.error("[DEBUG-UPLOAD] Error uploading image:", uploadError)
      return NextResponse.json({ error: `Error uploading image: ${uploadError.message}` }, { status: 500 })
    }

    console.log(`[DEBUG-UPLOAD] Image uploaded successfully: ${uploadData?.path}`)

    // Try to get a signed URL
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from("baby-pictures")
      .createSignedUrl(fileName, 60)

    if (urlError) {
      console.error("[DEBUG-UPLOAD] Error creating signed URL:", urlError)
    } else {
      console.log("[DEBUG-UPLOAD] Successfully created signed URL")
    }

    return NextResponse.json({
      success: true,
      fileName,
      path: uploadData?.path || "",
      signedUrl: urlData?.signedUrl || "",
      signedUrlError: urlError ? urlError.message : "",
    })
  } catch (error) {
    console.error("[DEBUG-UPLOAD] Unexpected error:", error)
    return NextResponse.json(
      {
        error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}
