"use node"

import { z } from "zod"
import { v } from "convex/values"

import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"

// AI výtah podmínek ze smlouvy (PDF) přes Kimi API (Moonshot). Spouští se na
// pozadí po nahrání; klíč je v Convex env (`npx convex env set MOONSHOT_API_KEY …`).

const isoDate = z
  .string()
  .nullable()
  .describe("Datum ve formátu yyyy-mm-dd, nebo null, pokud ve smlouvě není.")

const extractionSchema = z.object({
  title: z
    .string()
    .describe(
      "Krátký název smlouvy, např. „Smlouva o dílo – Acme s.r.o.“ nebo „NDA – Beta a.s.“."
    ),
  counterparty: z
    .string()
    .describe("Název druhé smluvní strany (ne dodavatele/freelancera)."),
  counterpartyIco: z.string().nullable().describe("IČO druhé smluvní strany."),
  summary: z
    .string()
    .describe("Shrnutí předmětu smlouvy ve 1–2 větách, česky."),
  startDate: isoDate,
  endDate: isoDate.describe(
    "Konec doby určité (yyyy-mm-dd). Null u smlouvy na dobu neurčitou."
  ),
  autoRenewal: z
    .boolean()
    .describe("Prodlužuje se smlouva automaticky, pokud ji nikdo nevypoví?"),
  renewalMonths: z
    .number()
    .nullable()
    .describe(
      "O kolik měsíců se smlouva při automatickém prodloužení prodlouží."
    ),
  noticeAmount: z.number().nullable().describe("Délka výpovědní lhůty."),
  noticeUnit: z
    .enum(["days", "months"])
    .nullable()
    .describe("Jednotka výpovědní lhůty."),
  rate: z
    .string()
    .nullable()
    .describe(
      "Sjednaná cena/sazba tak, jak je ve smlouvě, např. „1 200 Kč/h“."
    ),
  paymentDays: z.number().nullable().describe("Splatnost faktur ve dnech."),
  confidentialityUntil: isoDate.describe(
    "Do kdy trvá povinnost mlčenlivosti (yyyy-mm-dd). Pokud je určena dobou po skončení smlouvy a konec je známý, dopočítej datum."
  ),
  keyPoints: z
    .array(z.string())
    .describe(
      "Nanejvýš 5 ustanovení, na která si má freelancer dát pozor (smluvní pokuty, zákaz konkurence, převod autorských práv, odpovědnost za škodu, exkluzivita). Každé jednou krátkou větou česky."
    ),
})

const SYSTEM = `Analyzuješ smlouvy pro českého freelancera (OSVČ). Freelancer je dodavatel; druhá smluvní strana je jeho klient.
Vytáhni ze smlouvy údaje podle JSON schématu. Uváděj jen to, co ve smlouvě skutečně stojí – nic si nedomýšlej; chybějící údaj vrať jako null.`

const BASE_URL = "https://api.moonshot.ai/v1"
const MODEL = "kimi-k3"

class KimiError extends Error {
  constructor(readonly status: number) {
    super(`Kimi API ${status}`)
  }
}

async function kimi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MOONSHOT_API_KEY ?? ""}`,
      ...init.headers,
    },
  })
  if (!res.ok) {
    console.error(await res.text())
    throw new KimiError(res.status)
  }
  return res
}

/** Kimi neumí PDF přímo v chatu – text z něj vytáhne jejich Files API. */
async function extractPdfText(pdf: Blob) {
  const form = new FormData()
  form.append("file", pdf, "smlouva.pdf")
  form.append("purpose", "file-extract")
  const file = (await (
    await kimi("/files", { method: "POST", body: form })
  ).json()) as { id: string }
  try {
    return await (await kimi(`/files/${file.id}/content`)).text()
  } finally {
    // Nahrané soubory se počítají do kvóty úložiště; text už máme.
    await kimi(`/files/${file.id}`, { method: "DELETE" }).catch(() => {})
  }
}

export const extract = internalAction({
  args: { id: v.id("contracts"), fileId: v.id("_storage") },
  handler: async (ctx, { id, fileId }) => {
    try {
      const pdf = await ctx.storage.get(fileId)
      if (!pdf) throw new Error("Soubor smlouvy nebyl nalezen.")
      const text = await extractPdfText(pdf)

      const { $schema: _, ...schema } = z.toJSONSchema(extractionSchema)
      const response = (await (
        await kimi("/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            reasoning_effort: "high",
            max_tokens: 32000,
            response_format: {
              type: "json_schema",
              json_schema: { name: "contract_terms", schema },
            },
            messages: [
              { role: "system", content: SYSTEM },
              { role: "system", content: text },
              {
                role: "user",
                content: `Dnes je ${new Date().toISOString().slice(0, 10)}. Vytáhni podmínky této smlouvy.`,
              },
            ],
          }),
        })
      ).json()) as {
        choices: { finish_reason: string; message: { content: string } }[]
      }

      const choice = response.choices[0]
      if (choice?.finish_reason !== "stop") {
        throw new Error("AI smlouvu nedokázala zpracovat.")
      }
      const parsed = extractionSchema.safeParse(
        JSON.parse(choice.message.content)
      )
      if (!parsed.success) {
        console.error(parsed.error)
        throw new Error("AI vrátila neúplné údaje, zkuste to znovu.")
      }
      const out = parsed.data

      const orUndef = <T>(value: T | null) => value ?? undefined
      await ctx.runMutation(internal.contracts.applyExtraction, {
        id,
        title: out.title,
        terms: {
          counterparty: out.counterparty,
          counterpartyIco: orUndef(out.counterpartyIco),
          summary: out.summary,
          startDate: orUndef(out.startDate),
          endDate: orUndef(out.endDate),
          autoRenewal: out.autoRenewal,
          renewalMonths: orUndef(out.renewalMonths),
          notice:
            out.noticeAmount && out.noticeUnit
              ? { amount: out.noticeAmount, unit: out.noticeUnit }
              : undefined,
          rate: orUndef(out.rate),
          paymentDays: orUndef(out.paymentDays),
          confidentialityUntil: orUndef(out.confidentialityUntil),
          keyPoints: out.keyPoints.slice(0, 5),
        },
      })
    } catch (err) {
      console.error(err)
      const message =
        err instanceof KimiError
          ? err.status === 401
            ? "Chybí nebo je neplatný MOONSHOT_API_KEY."
            : err.status === 429
              ? "AI je přetížená nebo došel kredit, zkuste to za chvíli."
              : `Chyba AI (${err.status}).`
          : err instanceof SyntaxError
            ? "AI vrátila neplatnou odpověď, zkuste to znovu."
            : err instanceof Error
              ? err.message
              : "Neznámá chyba."
      await ctx.runMutation(internal.contracts.failExtraction, {
        id,
        error: message,
      })
    }
  },
})
