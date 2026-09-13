import { NextRequest, NextResponse } from "next/server"
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"

import { api } from "@/convex/_generated/api"
import { AUTH_COOKIE, AUTH_COOKIE_OPTIONS, expectedToken } from "@/lib/auth"
import {
  clearChallengeCookie,
  convexClient,
  readChallengeCookie,
  relyingParty,
  setChallengeCookie,
} from "@/lib/passkey"

// Přihlášení passkey. Bez `allowCredentials` – passkeys jsou discoverable,
// prohlížeč rovnou nabídne Touch ID bez výběru účtu.

export async function GET(req: NextRequest) {
  const options = await generateAuthenticationOptions({
    rpID: relyingParty(req).rpID,
    userVerification: "required",
  })
  // Prohlížeč má rovnou nabídnout Touch ID na tomto zařízení, ne QR kód pro telefon.
  options.hints = ["client-device"]

  const res = NextResponse.json(options)
  await setChallengeCookie(res, options.challenge)
  return res
}

export async function POST(req: NextRequest) {
  const expectedChallenge = await readChallengeCookie(req)
  if (!expectedChallenge) {
    return NextResponse.json(
      { error: "Platnost požadavku vypršela, zkuste to znovu." },
      { status: 400 }
    )
  }

  const { rpID, origin } = relyingParty(req)
  const convex = convexClient()
  try {
    const response = (await req.json()) as AuthenticationResponseJSON
    const passkey = await convex.query(api.passkeys.getByCredentialId, {
      credentialId: response.id,
    })
    if (!passkey) throw new Error("unknown credential")

    const { verified, authenticationInfo } = await verifyAuthenticationResponse(
      {
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: isoBase64URL.toBuffer(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports,
        },
      }
    )
    if (!verified) throw new Error("not verified")

    await convex.mutation(api.passkeys.markUsed, {
      credentialId: passkey.credentialId,
      counter: authenticationInfo.newCounter,
    })
  } catch {
    return NextResponse.json(
      { error: "Přihlášení přes passkey se nezdařilo." },
      { status: 401 }
    )
  }

  const res = NextResponse.json({ ok: true })
  clearChallengeCookie(res)
  res.cookies.set(AUTH_COOKIE, await expectedToken(), AUTH_COOKIE_OPTIONS)
  return res
}
