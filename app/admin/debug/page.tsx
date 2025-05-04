"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DebugPage() {
  const [supabaseInfo, setSupabaseInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [buckets, setBuckets] = useState<any[]>([])
  const [testUploadResult, setTestUploadResult] = useState<string | null>(null)

  const checkSupabaseConfig = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/debug-supabase")
      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setSupabaseInfo(data)
        setBuckets(data.buckets || [])
      }
    } catch (err) {
      setError(`Error checking Supabase config: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const testImageUpload = async () => {
    setLoading(true)
    setTestUploadResult(null)

    try {
      // Create a simple test image (1x1 pixel transparent PNG)
      const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
      const byteString = atob(base64Data)
      const arrayBuffer = new ArrayBuffer(byteString.length)
      const intArray = new Uint8Array(arrayBuffer)

      for (let i = 0; i < byteString.length; i++) {
        intArray[i] = byteString.charCodeAt(i)
      }

      const blob = new Blob([arrayBuffer], { type: "image/png" })
      const file = new File([blob], "test-image.png", { type: "image/png" })

      // Create form data
      const formData = new FormData()
      formData.append("image", file)

      // Send to test endpoint
      const response = await fetch("/api/debug-upload", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      // Defensive: handle possible null/empty signedUrl and other fields
      setTestUploadResult(
        JSON.stringify({
          ...result,
          signedUrl: result.signedUrl ? result.signedUrl.toString() : "",
          path: result.path ? result.path.toString() : "",
          signedUrlError: result.signedUrlError ? result.signedUrlError.toString() : ""
        }, null, 2)
      )
    } catch (err) {
      setTestUploadResult(`Error testing upload: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Supabase Debug Page</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Supabase Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={checkSupabaseConfig} disabled={loading} className="mb-4">
              {loading ? "Checking..." : "Check Supabase Configuration"}
            </Button>

            {error && (
              <div className="p-4 bg-red-900/20 border border-red-500/50 text-red-400 rounded-md mb-4">{error}</div>
            )}

            {supabaseInfo && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Connection Status</h3>
                  <p className={supabaseInfo.connected ? "text-green-500" : "text-red-500"}>
                    {supabaseInfo.connected ? "Connected" : "Not Connected"}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">URL Configuration</h3>
                  <p>Supabase URL: {supabaseInfo.url ? "Configured" : "Missing"}</p>
                  <p>Service Role Key: {supabaseInfo.serviceRoleKey ? "Configured" : "Missing"}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Storage Buckets ({buckets.length})</h3>
                  {buckets.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {buckets.map((bucket, i) => (
                        <li key={i}>
                          {bucket.name} ({bucket.public ? "Public" : "Private"})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No buckets found</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Image Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={testImageUpload} disabled={loading} className="mb-4">
              {loading ? "Testing..." : "Test Image Upload"}
            </Button>

            {testUploadResult && (
              <div className="p-4 bg-gray-900 rounded-md overflow-auto max-h-60">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">{testUploadResult}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
