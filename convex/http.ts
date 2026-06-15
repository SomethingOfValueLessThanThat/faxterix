import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { parseRaiffeisenEmail, htmlToText } from "../lib/bank-email"

// Webhook pro CloudMailin: Raiffka pošle email o pohybu na účtu → CloudMailin
// udělá HTTP POST sem. Email zparsujeme a spárujeme fakturu podle VS.
//
// Endpoint je veřejný, proto ho chráníme sdíleným tajemstvím (env
// CLOUDMAILIN_SECRET, `npx convex env set CLOUDMAILIN_SECRET <hodnota>`).
// Tajemství přijmeme kteroukoli z cest, ať to jde v CloudMailin nastavit jakkoli:
//   1) query param  ?key=<secret>
//   2) HTTP Basic auth  https://x:<secret>@host/...   (heslo = secret)
//   3) hlavička  x-cloudmailin-secret: <secret>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

/** Vytáhne předané tajemství z query / Basic auth / hlavičky. */
function extractSecret(req: Request): string | null {
  const url = new URL(req.url)
  const fromQuery = url.searchParams.get("key")
  if (fromQuery) return fromQuery

  const auth = req.headers.get("authorization") ?? ""
  const basic = auth.match(/^Basic\s+(.+)$/i)
  if (basic) {
    try {
      const decoded = atob(basic[1])
      const pass = decoded.slice(decoded.indexOf(":") + 1)
      if (pass) return pass
    } catch {
      // ignoruj špatně zakódovanou hlavičku
    }
  }

  return req.headers.get("x-cloudmailin-secret")
}

/** Vrátí text z `plain`, jinak (Raiffka posílá HTML-only) z `html`. */
function pickBody(plain?: string | null, html?: string | null): string {
  if (plain && plain.trim()) return plain
  if (html && html.trim()) return htmlToText(html)
  return ""
}

/** Vytáhne textové tělo emailu z JSON i multipart formátu CloudMailinu. */
async function extractPlain(req: Request): Promise<string> {
  const contentType = req.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    const p = (await req.json()) as { plain?: string; html?: string }
    return pickBody(p.plain, p.html)
  }

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const form = await req.formData()
    return pickBody(form.get("plain") as string, form.get("html") as string)
  }

  // Fallback: zkus JSON, jinak ber tělo jako prostý text.
  const raw = await req.text()
  try {
    const p = JSON.parse(raw) as { plain?: string; html?: string }
    return pickBody(p.plain, p.html) || raw
  } catch {
    return raw
  }
}

const cloudmailin = httpAction(async (ctx, req) => {
  const secret = process.env.CLOUDMAILIN_SECRET
  if (!secret) {
    console.error("cloudmailin: CLOUDMAILIN_SECRET není nastaven na deploymentu")
    return json({ error: "server_misconfigured" }, 500)
  }

  const provided = extractSecret(req)
  if (provided !== secret) {
    console.warn(
      `cloudmailin: 401 – klíč ${provided ? "nesedí" : "nedorazil"} ` +
        `(query/basic/header)`
    )
    return json({ error: "unauthorized" }, 401)
  }

  let plain = ""
  try {
    plain = await extractPlain(req)
  } catch (err) {
    console.error("cloudmailin: nelze přečíst tělo", err)
    return json({ error: "invalid_body" }, 400)
  }

  const parsed = parseRaiffeisenEmail(plain)
  if (!parsed || !parsed.isIncoming) {
    // Bez dumpu těla (osobní data) – jen délka pro případnou diagnostiku.
    console.log(`cloudmailin: ignored (parsed=${!!parsed}, len=${plain.length})`)
    return json({ status: "ignored" })
  }

  const result = await ctx.runMutation(internal.payments.applyIncomingPayment, {
    vs: parsed.vs,
    amount: parsed.amount,
  })

  console.log(
    `cloudmailin: VS=${parsed.vs} částka=${parsed.amount} ${parsed.currency} → ${result.status}`
  )
  return json(result)
})

const http = httpRouter()
http.route({ path: "/cloudmailin", method: "POST", handler: cloudmailin })

export default http
