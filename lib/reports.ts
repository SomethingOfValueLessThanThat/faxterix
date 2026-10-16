// Agregace nad fakturami pro stránku /reporty. Čisté funkce bez React/Convex,
// aby šly snadno testovat i znovu použít. Částky počítáme přes computeTotals,
// takže DPH respektuje, zda je firma plátce (vatPayer).

import { differenceInCalendarDays, format, subMonths } from "date-fns"
import { cs } from "date-fns/locale"

import type { Invoice, Client, InvoiceStatus } from "./types"
import { computeTotals, round2 } from "./invoice"
import { toLocalISODate, todayISO } from "./format"

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

  return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, limit)
}

/**
 * Den, kdy faktura přinesla peníze (null = nezaplacená). Faktury zaplacené před
 * zavedením `paidDate` datum úhrady nemají – bereme datum vystavení jako odhad.
 */
export function paidOn(inv: Invoice): string | null {
  if (inv.status !== "paid") return null
  return inv.paidDate || inv.issueDate || null
}

/** Příjmy za posledních 12 měsíců podle data úhrady. */
export function yearRevenue(
  invoices: Invoice[],
  vatPayer: boolean,
  today = new Date()
): number {
  const from = toLocalISODate(subMonths(today, 12))
  let total = 0
  for (const inv of invoices) {
    const paid = paidOn(inv)
    if (paid && paid > from) total += invoiceTotal(inv, vatPayer)
  }
  return round2(total)
}

export type BandStatus = "ok" | "warning" | "over"

export interface BandProgress {
  band: number
  limit: number
  year: number
  current: number // přijato v letošním kalendářním roce
  pending: number // odeslané, zatím nezaplacené faktury
  projected: number // odhad příjmů za celý rok
  remaining: number
  percentage: number
  status: BandStatus
}

/** Od kolika procent limitu (aktuálních nebo odhadovaných) varujeme. */
const WARNING_RATIO = 0.8

/**
 * Čerpání limitu pásma paušální daně. Limit se vztahuje k příjmům za kalendářní
 * rok, a to podle data přijetí peněz – faktura vystavená v prosinci a zaplacená
 * v lednu patří do dalšího roku.
 */
export function bandProgress(
  invoices: Invoice[],
  vatPayer: boolean,
  band: number,
  bandLimits: number[],
  today = new Date()
): BandProgress {
  const year = today.getFullYear()
  const todayISO = toLocalISODate(today)
  const windowStart = toLocalISODate(subMonths(today, 12))
  let current = 0
  let pending = 0
  let last12 = 0

  for (const inv of invoices) {
    const total = invoiceTotal(inv, vatPayer)
    const paid = paidOn(inv)
    if (paid) {
      if (paid.startsWith(String(year))) current += total
      if (paid > windowStart && paid <= todayISO) last12 += total
    } else if (inv.status === "sent") {
      pending += total
    }
  }

  // Zbytek roku dopočítáme tempem posledních 12 měsíců – extrapolace jen z
  // letoška by byla na začátku roku (pár týdnů dat) velmi nespolehlivá.
  const daysLeft = differenceInCalendarDays(new Date(year, 11, 31), today)
  const projected = current + (last12 / 365) * Math.max(0, daysLeft)

  const limit = bandLimits[band - 1] ?? bandLimits[2] ?? 2_000_000
  const status: BandStatus =
    current >= limit
      ? "over"
      : Math.max(current, projected) >= limit * WARNING_RATIO
        ? "warning"
        : "ok"

  return {
    band,
    limit,
    year,
    current: round2(current),
    pending: round2(pending),
    projected: round2(projected),
    remaining: round2(Math.max(0, limit - current)),
    percentage: current >= limit ? 100 : round2((current / limit) * 100),
    status,
  }
}

/**
 * Měsíční paušální daň podle pásma [1., 2., 3.] pro rok 2026.
 * Částky se mění každý rok – v lednu aktualizovat.
 */
export const FLAT_TAX_BY_BAND = [9_984, 16_745, 27_139]

export interface InvoiceBandImpact {
  year: number // rok, do jehož limitu faktura spadne
  band: number
  limit: number
  before: number // přijato + očekáváno v daném roce bez této faktury
  after: number
  /** Pásmo, do kterého se příjmy po faktuře vejdou; null = nad limity všech pásem. */
  newBand: number | null
  /** O kolik je paušál v novém pásmu za rok vyšší (0, pokud se pásmo nemění). */
  extraTaxYearly: number
  status: BandStatus
}

/**
 * Kdy peníze z faktury nejspíš přijdou: zaplacená podle data úhrady, ostatní
 * podle splatnosti – ale ne dřív než dnes, faktura po splatnosti se zaplatí až teď.
 */
function expectedPaymentDate(inv: Invoice, today: string): string {
  const paid = paidOn(inv)
  if (paid) return paid
  const due = inv.dueDate || inv.issueDate
  return due > today ? due : today
}

/**
 * Dopad rozepsané faktury na limit pásma paušální daně. Na rozdíl od
 * `bandProgress` počítá i s nezaplacenými fakturami – ty peníze do limitu
 * nejspíš dorazí taky. Paušální režim je jen pro neplátce DPH, proto bez DPH.
 */
export function invoiceBandImpact(
  invoice: Invoice,
  invoices: Invoice[],
  band: number,
  bandLimits: number[],
  today = todayISO()
): InvoiceBandImpact {
  const year = expectedPaymentDate(invoice, today).slice(0, 4)
  let before = 0
  for (const inv of invoices) {
    if (inv._id === invoice._id || inv.status === "draft") continue
    if (expectedPaymentDate(inv, today).startsWith(year)) {
      before += invoiceTotal(inv, false)
    }
  }
  const after = before + invoiceTotal(invoice, false)

  const limit = bandLimits[band - 1] ?? bandLimits[2] ?? 2_000_000
  const fitIndex = bandLimits.findIndex((l) => after <= l)
  const newBand = fitIndex === -1 ? null : fitIndex + 1
  const extraTaxYearly =
    newBand !== null && newBand > band
      ? (FLAT_TAX_BY_BAND[newBand - 1] - FLAT_TAX_BY_BAND[band - 1]) * 12
      : 0

  return {
    year: Number(year),
    band,
    limit,
    before: round2(before),
    after: round2(after),
    newBand,
    extraTaxYearly,
    status:
      after > limit
        ? "over"
        : after >= limit * WARNING_RATIO
          ? "warning"
          : "ok",
  }
}
