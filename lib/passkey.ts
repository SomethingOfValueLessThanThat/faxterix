// Serverové pomocníky pro přihlášení passkey (Touch ID) přes WebAuthn.
// Challenge si nedržíme v DB – posíláme ji v krátkodobé httpOnly cookie
// podepsané HMAC, takže si ji klient nemůže podvrhnout (jinak by šlo přehrát
// odchycenou odpověď; Apple passkeys mají counter stále 0).

import { NextRequest, NextResponse } from "next/server"
import { ConvexHttpClient } from "convex/browser"

import { sign } from "@/lib/auth"

export const RP_NAME = "FAXTERIX"

const CHALLENGE_COOKIE = "faxterix_webauthn"
const CHALLENGE_TTL = 5 * 60 // 5 minut

/**
 * RP ID a origin z URL požadavku – passkey je vázaná na doménu, takže lokálně
 * (localhost) a na produkci jde o různé passkeys.
 */
export function relyingParty(req: NextRequest) {
  return { rpID: req.nextUrl.hostname, origin: req.nextUrl.origin }
}

export function convexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url)
    throw new Error("NEXT_PUBLIC_CONVEX_URL není nastavené v prostředí.")
  return new ConvexHttpClient(url)
}

export async function setChallengeCookie(res: NextResponse, challenge: string) {
  const payload = `${challenge}.${Math.floor(Date.now() / 1000) + CHALLENGE_TTL}`
  res.cookies.set(CHALLENGE_COOKIE, `${payload}.${await sign(payload)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/passkey",
    maxAge: CHALLENGE_TTL,
  })
}

/** Vrátí challenge z cookie, pokud je podpis platný a nevypršela. */
export async function readChallengeCookie(
  req: NextRequest
): Promise<string | null> {
  const [challenge, exp, sig] =
    req.cookies.get(CHALLENGE_COOKIE)?.value.split(".") ?? []
  if (!challenge || !exp || !sig) return null
  if (Number(exp) < Date.now() / 1000) return null
  if (sig !== (await sign(`${challenge}.${exp}`))) return null
  return challenge
}

export function clearChallengeCookie(res: NextResponse) {
  res.cookies.set(CHALLENGE_COOKIE, "", { path: "/api/passkey", maxAge: 0 })
}

/** Hrubý název zařízení z User-Agentu, ať jde passkeys v nastavení rozlišit. */
export function deviceName(req: NextRequest): string {
  const ua = req.headers.get("user-agent") ?? ""
  if (ua.includes("iPhone")) return "iPhone"
  if (ua.includes("iPad")) return "iPad"
  if (ua.includes("Macintosh")) return "Mac"
  if (ua.includes("Android")) return "Android"
  if (ua.includes("Windows")) return "Windows"
  return "Zařízení"
}
