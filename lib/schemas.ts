// Zod schémata pro validaci uživatelských vstupů (formuláře) i externích dat
// (odpovědi z ARES). Doménové typy v `lib/types.ts` zůstávají zdrojem pravdy;
// tato schémata validují data na hranicích aplikace před uložením do store.

import { z } from "zod"

// --- nízkoúrovňové validátory polí -----------------------------------------

const ICO_RE = /^\d{8}$/
const PSC_RE = /^\d{3} ?\d{2}$/
const DIC_RE = /^[A-Z]{2}\d{8,10}$/i
// Předčíslí (0–6 číslic) - číslo účtu (2–10 číslic) / kód banky (4 číslice).
const BANK_ACCOUNT_RE = /^(\d{1,6}-)?\d{2,10}\/\d{4}$/
// Národní číslo (9 číslic, po trojicích) s volitelnou předvolbou +CC.
const PHONE_RE = /^(\+\d{1,3} ?)?\d{3} ?\d{3} ?\d{3}$/

const strip = (v: string) => v.replace(/\s+/g, "")
const isBlank = (v: string) => v.trim() === ""

/** Povinné IČO (8 číslic) – používá se ve flow „načti z ARES". */
export const icoSchema = z
  .string()
  .refine((v) => ICO_RE.test(strip(v)), "Zadejte platné IČO (8 číslic).")

const optionalIco = z
  .string()
  .refine((v) => isBlank(v) || ICO_RE.test(strip(v)), "IČO musí mít 8 číslic.")

const optionalDic = z
  .string()
  .refine(
    (v) => isBlank(v) || DIC_RE.test(strip(v)),
    "Neplatné DIČ (např. CZ12345678)."
  )

const optionalEmail = z
  .string()
  .refine(
    (v) => isBlank(v) || z.email().safeParse(v.trim()).success,
    "Neplatný e-mail."
  )

const optionalPhone = z
  .string()
  .refine(
    (v) => isBlank(v) || PHONE_RE.test(v.trim()),
    "Zadejte platné telefonní číslo (např. +420 123 456 789)."
  )

const optionalBankAccount = z
  .string()
  .refine(
    (v) => isBlank(v) || BANK_ACCOUNT_RE.test(strip(v)),
    "Neplatné číslo účtu (formát 19-1234567890/0100)."
  )

const optionalPsc = z
  .string()
  .refine((v) => isBlank(v) || PSC_RE.test(v.trim()), "PSČ musí mít 5 číslic.")

const dueDaysSchema = z
  .number()
  .int("Splatnost musí být celé číslo.")
  .min(0, "Splatnost nemůže být záporná.")
  .max(3650, "Splatnost je příliš velká.")

// --- objektová schémata ------------------------------------------------------

export const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zip: optionalPsc,
  country: z.string(),
})

/** Profil firmy z Nastavení. */
export const companyProfileSchema = z.object({
  name: z.string(),
  ico: optionalIco,
  dic: optionalDic,
  vatPayer: z.boolean(),
  address: addressSchema,
  email: optionalEmail,
  phone: optionalPhone,
  bankAccount: optionalBankAccount,
  dueDays: dueDaysSchema,
  numberFormat: z.string().min(1, "Formát čísla faktury nesmí být prázdný."),
  selectedBand: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  bandLimits: z.array(z.number()).min(3).max(3),
  flatTaxMonthly: z.number().min(0),
})

/** Klient při ručním vyplnění / úpravě. */
export const clientDraftSchema = z.object({
  name: z.string().trim().min(1, "Vyplňte název klienta."),
  ico: optionalIco,
  dic: optionalDic,
  email: optionalEmail,
  address: addressSchema,
})

export const invoiceItemSchema = z.object({
  id: z.string(),
  description: z.string().trim().min(1, "Vyplňte popis položky."),
  quantity: z
    .number()
    .refine((n) => Number.isFinite(n), "Zadejte počet.")
    .refine((n) => n > 0, "Počet musí být kladný."),
  unit: z.string().trim().min(1, "Vyplňte měrnou jednotku."),
  unitPrice: z
    .number()
    .refine((n) => Number.isFinite(n), "Zadejte cenu.")
    .refine((n) => n >= 0, "Cena nesmí být záporná."),
  vatRate: z.number().min(0, "Neplatná sazba DPH."),
})

/** Validace faktury před uložením. */
export const invoiceDraftSchema = z.object({
  clientId: z
    .string()
    .nullable()
    .refine((v) => !!v, "Vyberte klienta."),
  issueDate: z.string().min(1, "Vyberte datum vystavení."),
  items: z
    .array(invoiceItemSchema)
    .min(1, "Přidejte alespoň jednu položku."),
})

/** Tvar dat, který vrací naše `/api/ares` route a konzumují formuláře. */
export const aresResultSchema = z.object({
  name: z.string(),
  ico: z.string(),
  dic: z.string(),
  address: addressSchema,
})

/** Surová (částečná) odpověď z veřejného ARES API. */
export const aresRawSchema = z.object({
  obchodniJmeno: z.string().optional(),
  ico: z.string().optional(),
  dic: z.string().optional(),
  sidlo: z
    .object({
      nazevUlice: z.string().optional(),
      cisloDomovni: z.number().optional(),
      cisloOrientacni: z.number().optional(),
      nazevObce: z.string().optional(),
      nazevCastiObce: z.string().optional(),
      psc: z.number().optional(),
      textovaAdresa: z.string().optional(),
    })
    .optional(),
})

// --- pomocníci pro formuláře -------------------------------------------------

/** Zmapuje Zod chyby na slovník `cesta -> hláška` (první chyba na pole). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".")
    if (!(key in out)) out[key] = issue.message
  }
  return out
}

/** První chybová hláška – vhodná pro toast. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Zkontrolujte zadané údaje."
}
