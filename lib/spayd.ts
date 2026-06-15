// Generování řetězce QR Platba (formát SPAYD 1.0) podle ČBA.
// https://qr-platba.cz / norma SPAYD

export interface SpaydInput {
  iban: string
  amount: number
  currency?: string
  variableSymbol?: string
  message?: string
  recipientName?: string
  dueDate?: string // ISO yyyy-mm-dd
}

function sanitizeIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase()
}

/**
 * Převede české číslo účtu (formát `[předčíslí-]číslo/kód`) na IBAN.
 * Vrátí null pokud formát není rozpoznán.
 */
export function czechAccountToIban(bankAccount: string): string | null {
  const match = bankAccount
    .trim()
    .match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/)
  if (!match) return null

  const prefix = (match[1] ?? "0").padStart(6, "0")
  const number = match[2].padStart(10, "0")
  const bankCode = match[3]
  const bban = bankCode + prefix + number // 20 číslic

  // Převod "CZ00" na číslice: C=12, Z=35 → "123500"
  let remainder = 0
  for (const ch of bban + "123500") {
    remainder = (remainder * 10 + parseInt(ch)) % 97
  }
  const checkDigits = String(98 - remainder).padStart(2, "0")
  return `CZ${checkDigits}${bban}`
}

/** SPAYD povoluje jen ASCII; diakritiku odstraníme a hvězdičky vypustíme. */
function sanitizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\*/g, "")
    .toUpperCase()
}

export function buildSpayd(input: SpaydInput): string {
  const header = ["SPD", "1.0"]
  const fields: string[] = []

  fields.push(`ACC:${sanitizeIban(input.iban)}`)
  if (input.amount > 0) fields.push(`AM:${input.amount.toFixed(2)}`)
  fields.push(`CC:${input.currency ?? "CZK"}`)

  if (input.variableSymbol) fields.push(`X-VS:${input.variableSymbol}`)
  if (input.dueDate) fields.push(`DT:${input.dueDate.replace(/-/g, "")}`)
  if (input.recipientName)
    fields.push(`RN:${sanitizeText(input.recipientName)}`)
  if (input.message)
    fields.push(`MSG:${sanitizeText(input.message).slice(0, 60)}`)

  return [...header, ...fields].join("*")
}
