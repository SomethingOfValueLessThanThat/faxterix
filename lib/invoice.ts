import type { Invoice, InvoiceItem, CompanyProfile } from "./types"

export interface VatBreakdownRow {
  rate: number
  base: number
  vat: number
  total: number
}

export interface InvoiceTotals {
  subtotal: number // základ bez DPH
  vat: number // celkové DPH
  total: number // k úhradě
  vatRows: VatBreakdownRow[]
}

export function lineTotal(item: InvoiceItem): number {
  return round2(item.quantity * item.unitPrice)
}

/** Spočítá souhrny faktury. Pokud firma není plátce DPH, DPH je nulové. */
export function computeTotals(
  items: InvoiceItem[],
  vatPayer: boolean
): InvoiceTotals {
  const byRate = new Map<number, VatBreakdownRow>()
  let subtotal = 0
  let vat = 0

  for (const item of items) {
    const base = lineTotal(item)
    const rate = vatPayer ? item.vatRate : 0
    const itemVat = round2((base * rate) / 100)
    subtotal += base
    vat += itemVat

    const row = byRate.get(rate) ?? { rate, base: 0, vat: 0, total: 0 }
    row.base = round2(row.base + base)
    row.vat = round2(row.vat + itemVat)
    row.total = round2(row.base + row.vat)
    byRate.set(rate, row)
  }

  subtotal = round2(subtotal)
  vat = round2(vat)

  return {
    subtotal,
    vat,
    total: round2(subtotal + vat),
    vatRows: [...byRate.values()].sort((a, b) => a.rate - b.rate),
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Vygeneruje další číslo faktury.
 *
 * Pokud už pro aktuální rok nějaká faktura existuje (např. po importu), navážeme
 * na ni: zachováme její prefix i šířku pořadového čísla (zarovnání nulami) a jen
 * zvýšíme nejvyšší pořadí o jedna. Tím nová čísla odpovídají dosavadnímu
 * číslování bez ohledu na výchozí formát.
 *
 * Když pro daný rok žádná faktura není, použije se formát z profilu.
 * Podporované tokeny: {YYYY} rok, {MM} měsíc, {NNNN}/{NNN}/{NN} pořadové číslo.
 */
export function nextInvoiceNumber(
  existing: Invoice[],
  profile: CompanyProfile,
  date = new Date()
): string {
  const year = date.getFullYear()
  const yearStr = String(year)

  // Faktury aktuálního roku poznáme podle prefixu čísla (spolehlivější než
  // parsování data, které může mít z importu nečekaný formát).
  const thisYear = existing.filter((inv) => inv.number.startsWith(yearStr))

  let prefix: string | null = null
  let width = 0
  let maxSeq = 0
  for (const inv of thisYear) {
    // Pořadové číslo = poslední skupina číslic v čísle faktury.
    const m = inv.number.match(/(\d+)\s*$/)
    if (!m) continue
    const seqStr = m[1]
    const seq = Number(seqStr)
    if (seq > maxSeq) {
      maxSeq = seq
      width = seqStr.length
      prefix = inv.number.slice(0, inv.number.length - seqStr.length)
    }
  }

  if (prefix !== null) {
    return prefix + String(maxSeq + 1).padStart(width, "0")
  }

  // Fallback: žádná faktura pro letošek – sestavíme číslo z formátu profilu.
  const format = profile.numberFormat || "{YYYY}{NNNN}"
  const seq = thisYear.length + 1
  return format
    .replace("{YYYY}", yearStr)
    .replace("{MM}", String(date.getMonth() + 1).padStart(2, "0"))
    .replace(/\{N+\}/g, (token) => {
      const tokenWidth = token.length - 2
      return String(seq).padStart(tokenWidth, "0")
    })
}

export const emptyItem = (vatRate = 21): InvoiceItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unit: "hodina",
  unitPrice: 0,
  vatRate,
})
