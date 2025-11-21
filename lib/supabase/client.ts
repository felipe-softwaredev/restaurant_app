import { createBrowserClient } from "@supabase/ssr"

let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  // Don't cache the client in browser - recreate to ensure fresh cookie handling
  if (typeof window === "undefined") {
    throw new Error("getSupabaseClient should only be called in browser context")
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      "Supabase environment variables are missing. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.",
    )
  }

  // Create a new client each time to ensure cookies are properly handled
  return createBrowserClient(url, key, {
    cookies: {
      getAll() {
        return document.cookie.split("; ").map((cookie) => {
          const [name, ...rest] = cookie.split("=")
          return { name, value: decodeURIComponent(rest.join("=")) }
        })
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          let cookieString = `${name}=${encodeURIComponent(value)}`
          if (options?.maxAge) {
            cookieString += `; max-age=${options.maxAge}`
          }
          if (options?.domain) {
            cookieString += `; domain=${options.domain}`
          }
          if (options?.path) {
            cookieString += `; path=${options.path}`
          }
          if (options?.sameSite) {
            cookieString += `; samesite=${options.sameSite}`
          }
          if (options?.secure) {
            cookieString += `; secure`
          }
          document.cookie = cookieString
        })
      },
    },
  })
}
