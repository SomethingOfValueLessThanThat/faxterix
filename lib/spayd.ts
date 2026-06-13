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
