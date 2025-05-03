"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminLogin } from "@/app/actions"

// Add this export to disable static generation for this page
export const dynamic = "force-dynamic"

export default function AdminLoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return

    setIsSubmitting(true)
    setError("")

    try {
      const result = await adminLogin(password)
      if (result.success) {
        router.push("/admin/dashboard")
      } else {
        setError("Invalid password")
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error("Login failed:", error)
      setError("Login failed. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-arcane-navy p-4">
      <Card className="w-full max-w-md border-2 border-arcane-blue/50 bg-arcane-navy/80 shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-arcane-blue">Admin Login</CardTitle>
          <CardDescription className="text-arcane-gray">Enter the admin password to manage the game</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-arcane-gray-light">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-arcane-blue/30 bg-arcane-navy/50 text-arcane-gray-light focus:border-arcane-blue focus:ring-arcane-blue"
                required
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <Button
              type="submit"
              className="w-full bg-arcane-blue hover:bg-arcane-blue/80 text-arcane-navy font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
