// Termíny ze smluv: konec, poslední den výpovědi před automatickým
// prodloužením, konec mlčenlivosti. Čisté funkce bez React/Convex.

import {
  addMonths,
  differenceInCalendarDays,
  parseISO,
  subDays,
  subMonths,
} from "date-fns"

import type { Contract, ContractTerms } from "./types"
import { toLocalISODate, todayISO } from "./format"

export type DeadlineKind = "end" | "notice" | "renewal" | "confidentiality"

export interface ContractDeadline {
  contractId: string
  contractTitle: string
  kind: DeadlineKind
  date: string // ISO yyyy-mm-dd
  daysLeft: number
}

export const DEADLINE_LABELS: Record<DeadlineKind, string> = {
  end: "Konec smlouvy",
  notice: "Poslední den pro výpověď",
  renewal: "Automatické prodloužení",
  confidentiality: "Konec mlčenlivosti",
}

/** Bez údaje ve smlouvě počítáme s prodloužením o rok, to je nejčastější. */
const DEFAULT_RENEWAL_MONTHS = 12

/** Od kolika dní předem termín zvýrazníme. */
export const URGENT_DAYS = 30

function noticeDate(end: Date, notice: NonNullable<ContractTerms["notice"]>) {
  return notice.unit === "months"
    ? subMonths(end, notice.amount)
    : subDays(end, notice.amount)
}

/** Nadcházející termíny jedné smlouvy (jen dnešní a budoucí). */
export function contractDeadlines(
  contract: Contract,
  today = todayISO()
): Omit<ContractDeadline, "contractId" | "contractTitle" | "daysLeft">[] {
  const terms = contract.terms
  if (!terms) return []
  const out: { kind: DeadlineKind; date: Date }[] = []
  const now = parseISO(today)

  if (terms.endDate) {
    let end = parseISO(terms.endDate)
    if (terms.autoRenewal) {
      // Prošlé období se už prodloužilo – posuneme konec na aktuální období.
      const step = terms.renewalMonths || DEFAULT_RENEWAL_MONTHS
      while (end < now) end = addMonths(end, step)
      out.push({ kind: "renewal", date: end })
      if (terms.notice) {
        // Když lhůta na výpověď v tomto období už propadla, platí až ta další.
        let notice = noticeDate(end, terms.notice)
        if (notice < now)
          notice = noticeDate(addMonths(end, step), terms.notice)
        out.push({ kind: "notice", date: notice })
      }
    } else if (end >= now) {
      out.push({ kind: "end", date: end })
    }
  }

  if (terms.confidentialityUntil) {
    const until = parseISO(terms.confidentialityUntil)
    if (until >= now) out.push({ kind: "confidentiality", date: until })
  }

  return out.map((d) => ({ kind: d.kind, date: toLocalISODate(d.date) }))
}

/** Termíny všech smluv do `withinDays` dní, od nejbližšího. */
export function upcomingDeadlines(
  contracts: Contract[],
  withinDays = 90,
  today = todayISO()
): ContractDeadline[] {
  const now = parseISO(today)
  return contracts
    .flatMap((c) =>
      contractDeadlines(c, today).map((d) => ({
        ...d,
        contractId: c._id,
        contractTitle: c.title,
        daysLeft: differenceInCalendarDays(parseISO(d.date), now),
      }))
    )
    .filter((d) => d.daysLeft <= withinDays)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Smlouva na dobu určitou, která už skončila. */
export function isExpired(contract: Contract, today = todayISO()): boolean {
  const terms = contract.terms
  return !!terms?.endDate && !terms.autoRenewal && terms.endDate < today
}

/** „3 měsíce“, „30 dní“ – česká skloňování pro výpovědní lhůtu. */
export function formatNotice(
  notice: NonNullable<ContractTerms["notice"]>
): string {
  const n = notice.amount
  if (notice.unit === "months") {
    return `${n} ${n === 1 ? "měsíc" : n >= 2 && n <= 4 ? "měsíce" : "měsíců"}`
  }
  return `${n} ${n === 1 ? "den" : n >= 2 && n <= 4 ? "dny" : "dní"}`
}

/** „za 5 dní“, „zítra“, „dnes“. */
export function formatDaysLeft(days: number): string {
  if (days === 0) return "dnes"
  if (days === 1) return "zítra"
  return `za ${days} ${days >= 2 && days <= 4 ? "dny" : "dní"}`
}
