// Agregace nad fakturami pro stránku /reporty. Čisté funkce bez React/Convex,
// aby šly snadno testovat i znovu použít. Částky počítáme přes computeTotals,
// takže DPH respektuje, zda je firma plátce (vatPayer).

import { format, subMonths } from "date-fns"
import { cs } from "date-fns/locale"

import type { Invoice, Client, InvoiceStatus } from "./types"
import { computeTotals } from "./invoice"
import { round2 } from "./invoice"
import { todayISO } from "./format"

/** Částka k úhradě (vč. DPH) jedné faktury. */
export function invoiceTotal(inv: Invoice, vatPayer: boolean): number {
  return computeTotals(inv.items, vatPayer).total
}

/** Faktura je po splatnosti, pokud není zaplacená a dueDate je v minulosti. */
function isOverdue(inv: Invoice, today: string): boolean {
  return inv.status !== "paid" && !!inv.dueDate && inv.dueDate < today
}

export interface SummaryStats {
  invoiced: number // celkem vyfakturováno (vše)
  paid: number // zaplaceno
  unpaid: number // nezaplaceno (sent + draft, vč. po splatnosti)
  overdue: number // částka po splatnosti
  vat: number // DPH k odvedení (ze všech faktur)
  invoiceCount: number
  clientCount: number
  overdueCount: number
  avgInvoice: number // průměrná částka faktury
}

/** Souhrnné KPI nad všemi fakturami a klienty. */
export function summaryStats(
  invoices: Invoice[],
  clients: Client[],
  vatPayer: boolean
): SummaryStats {
  const today = todayISO()
  let invoiced = 0
  let paid = 0
  let unpaid = 0
  let overdue = 0
  let vat = 0

  for (const inv of invoices) {
    const totals = computeTotals(inv.items, vatPayer)
    invoiced += totals.total
    vat += totals.vat
    if (inv.status === "paid") {
      paid += totals.total
    } else {
      unpaid += totals.total
      if (isOverdue(inv, today)) overdue += totals.total
    }
  }

  const invoiceCount = invoices.length
  return {
    invoiced: round2(invoiced),
    paid: round2(paid),
    unpaid: round2(unpaid),
    overdue: round2(overdue),
    vat: round2(vat),
    invoiceCount,
    clientCount: clients.length,
    overdueCount: invoices.filter((inv) => isOverdue(inv, today)).length,
    avgInvoice: invoiceCount ? round2(invoiced / invoiceCount) : 0,
  }
}

export interface MonthRevenue {
  month: string // "2026-06"
  label: string // "čvn"
  paid: number
  unpaid: number
}

/**
 * Tržby za posledních `months` měsíců, rozdělené na zaplacené a nezaplacené.
 * Měsíc faktury bereme podle issueDate (klíč yyyy-mm).
 */
export function revenueByMonth(
  invoices: Invoice[],
  vatPayer: boolean,
  months = 12
): MonthRevenue[] {
  const buckets = new Map<string, MonthRevenue>()
  const now = new Date()

  // Předvyplníme všechny měsíce v okně, ať graf nemá díry.
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i)
    const key = format(d, "yyyy-MM")
    buckets.set(key, {
      month: key,
      label: format(d, "LLL", { locale: cs }),
      paid: 0,
      unpaid: 0,
    })
  }

  for (const inv of invoices) {
    const key = inv.issueDate?.slice(0, 7)
    const bucket = key ? buckets.get(key) : undefined
    if (!bucket) continue // mimo okno – ignorujeme
    const total = invoiceTotal(inv, vatPayer)
    if (inv.status === "paid") bucket.paid = round2(bucket.paid + total)
    else bucket.unpaid = round2(bucket.unpaid + total)
  }

  return [...buckets.values()]
}

export interface StatusBucket {
  status: InvoiceStatus
  label: string
  count: number
  amount: number
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Koncept",
  sent: "Odeslané",
  paid: "Zaplacené",
}

/** Počty a částky faktur podle stavu. */
export function countByStatus(
  invoices: Invoice[],
  vatPayer: boolean
): StatusBucket[] {
  const order: InvoiceStatus[] = ["draft", "sent", "paid"]
  const map = new Map<InvoiceStatus, StatusBucket>(
    order.map((status) => [
      status,
      { status, label: STATUS_LABELS[status], count: 0, amount: 0 },
    ])
  )

  for (const inv of invoices) {
    const bucket = map.get(inv.status)
    if (!bucket) continue
    bucket.count += 1
    bucket.amount = round2(bucket.amount + invoiceTotal(inv, vatPayer))
  }

  return order.map((status) => map.get(status)!)
}

export interface ClientRevenue {
  name: string
  amount: number
  count: number
}

/** Top klienti podle vyfakturované částky. */
export function topClients(
  invoices: Invoice[],
  vatPayer: boolean,
  limit = 5
): ClientRevenue[] {
  const map = new Map<string, ClientRevenue>()

  for (const inv of invoices) {
    const name = inv.client?.name?.trim() || "Bez klienta"
    const entry = map.get(name) ?? { name, amount: 0, count: 0 }
    entry.amount = round2(entry.amount + invoiceTotal(inv, vatPayer))
    entry.count += 1
    map.set(name, entry)
  }

  return [...map.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

/** Tržby za poslední rok. */
export function yearRevenue(
  invoices: Invoice[],
  vatPayer: boolean
): number {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoISO = oneYearAgo.toISOString().split("T")[0]

  let total = 0
  for (const inv of invoices) {
    if (inv.issueDate && inv.issueDate >= oneYearAgoISO && inv.status === "paid") {
      total += invoiceTotal(inv, vatPayer)
    }
  }
  return round2(total)
}

export interface BandProgress {
  band: number
  limit: number
  current: number
  remaining: number
  percentage: number
}

/** Pokrok k dosažení limitu daného pasma. */
export function bandProgress(
  invoices: Invoice[],
  vatPayer: boolean,
  band: number,
  bandLimits: number[]
): BandProgress {
  const current = yearRevenue(invoices, vatPayer)
  const limit = bandLimits[band - 1] ?? bandLimits[2] ?? 5_000_000
  const remaining = Math.max(0, limit - current)
  const percentage = current >= limit ? 100 : round2((current / limit) * 100)

  return {
    band,
    limit,
    current,
    remaining: round2(remaining),
    percentage,
  }
}
