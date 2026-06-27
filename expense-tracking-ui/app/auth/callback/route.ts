import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// OAuth + Magic Link landing route. Supabase redirects here with a `code`
// that we exchange for a session cookie, then send the user on their way.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  // Behind Netlify's proxy, `origin` from request.url can be an internal host,
  // which is how logins end up bouncing to localhost. Prefer the forwarded host
  // (the public site URL) in production; fall back to `origin` locally.
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https"
  const isLocal = process.env.NODE_ENV === "development"
  const base = !isLocal && forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${base}${next}`)
    }
  }

  return NextResponse.redirect(`${base}/auth/auth-code-error`)
}
