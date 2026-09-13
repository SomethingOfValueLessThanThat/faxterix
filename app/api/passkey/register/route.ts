import { NextRequest, NextResponse } from "next/server"
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"

import { api } from "@/convex/_generated/api"
import {
  RP_NAME,
  clearChallengeCookie,
  convexClient,
  deviceName,
  readChallengeCookie,
  relyingParty,
  setChallengeCookie,
} from "@/lib/passkey"

// Registrace nové passkey. Není v PUBLIC_PATHS – middleware pustí jen
// přihlášeného uživatele.

export async function GET(req: NextRequest) {
  const { rpID } = relyingParty(req)
  const existing = await convexClient().query(api.passkeys.listCredentialIds)

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: RP_NAME,
    // Pevné ID – aplikace má jediného uživatele, opakovaná registrace na
    // stejném zařízení tak existující passkey přepíše místo duplikátu.
    userID: new TextEncoder().encode("faxterix"),
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports,
    })),
    preferredAuthenticatorType: "localDevice",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
      userVerification: "required",
    },
  })

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
  try {
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: await req.json(),
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })
    if (!verified) throw new Error("not verified")

    const { credential } = registrationInfo
    await convexClient().mutation(api.passkeys.create, {
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports,
      name: deviceName(req),
    })
  } catch {
    return NextResponse.json(
      { error: "Passkey se nepodařilo ověřit." },
      { status: 400 }
    )
  }

  const res = NextResponse.json({ ok: true })
  clearChallengeCookie(res)
  return res
}
