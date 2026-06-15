import { NextRequest, NextResponse } from "next/server"

import { AUTH_COOKIE, expectedToken, verifyPassword } from "@/lib/auth"

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 dní
}

export async function POST(req: NextRequest) {
  let password = ""
  try {
    const body = await req.json()
    password = typeof body?.password === "string" ? body.password : ""
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 })
  }

  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "Nesprávné heslo." }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, await expectedToken(), COOKIE_OPTIONS)
  return res
}

// Odhlášení.
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 })
  return res
}
