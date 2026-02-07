"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const supabase = getSupabaseClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
      } else if (data.user) {
        router.push("/admin/dashboard")
      }
    } catch (err) {
      setError("An error occurred during login")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      <Link href="/" className="mb-8 self-start">
        <Button variant="ghost" size="sm" className="gap-2">
          ← Back to home
        </Button>
      </Link>
      <div className="flex flex-1 flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-muted-foreground">
            Manage orders, inventory, and menu from the admin dashboard.
          </p>
        </div>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">{error}</div>}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@restaurant.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              <Link href="/">Back to home</Link>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
      </div>
    </main>
  )
}
