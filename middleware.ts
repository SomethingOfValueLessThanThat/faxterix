import { NextRequest, NextResponse } from "next/server"

import { AUTH_COOKIE, isValidToken } from "@/lib/auth"

// Cesty, které musí být dostupné i bez přihlášení.
const PUBLIC_PATHS = ["/login", "/api/login"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next()
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (await isValidToken(token)) {
    return NextResponse.next()
  }

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.search = ""
  if (pathname !== "/") {
    loginUrl.searchParams.set("from", pathname + req.nextUrl.search)
  }
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Vše kromě statických assetů a Next interních cest.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.\\w+$).*)"],
}
