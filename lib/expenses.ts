// Agregace nad pravidelnými výdaji pro stránku /expenses. Čisté funkce bez
// Reactu/Convexu, aby šly snadno testovat i znovu použít. Roční výdaje se pro
// „měsíční přepočet" dělí dvanácti.

import type { ChecklistItemId, Expense, ExpensePayment } from "./types"
import { round2 } from "./invoice"

/** Měsíční ekvivalent výdaje (roční / 12, měsíční beze změny). */
export function monthlyEquivalent(e: Expense): number {
  return e.period === "yearly" ? e.amount / 12 : e.amount
}

export interface ExpenseSummary {
  /** Celkový výdaj na měsíc (měsíční + roční/12). */
  monthlyTotal: number
  /** Celkový výdaj na rok (monthlyTotal × 12). */
  yearlyTotal: number
  /** Součet čistě měsíčních výdajů (na měsíc). */
  monthlyRecurring: number
  /** Součet ročních výdajů přepočtený na měsíc (roční/12). */
  yearlyAsMonthly: number
  monthlyCount: number
  yearlyCount: number
}

/** Souhrnné KPI nad všemi výdaji. */
export function expenseSummary(expenses: Expense[]): ExpenseSummary {
  let monthlyRecurring = 0
  let yearlyAsMonthly = 0
  let monthlyCount = 0
  let yearlyCount = 0

  for (const e of expenses) {
    if (e.period === "yearly") {
      yearlyAsMonthly += e.amount / 12
      yearlyCount += 1
    } else {
      monthlyRecurring += e.amount
      monthlyCount += 1
    }
  }

  const monthlyTotal = monthlyRecurring + yearlyAsMonthly
  return {
    monthlyTotal: round2(monthlyTotal),
    yearlyTotal: round2(monthlyTotal * 12),
    monthlyRecurring: round2(monthlyRecurring),
    yearlyAsMonthly: round2(yearlyAsMonthly),
    monthlyCount,
    yearlyCount,
  }
}

export interface ExpenseBreakdown {
  id: string
  name: string
  period: Expense["period"]
  /** Měsíční ekvivalent částky. */
  monthly: number
  /** Podíl na celkovém měsíčním výdaji (0–100). */
  share: number
}

/**
 * Jednotlivé výdaje seřazené podle měsíčního ekvivalentu (největší nahoře),
 * s vypočteným podílem na celku. Slouží pro koláčový graf i žebříček.
 */
export function expenseBreakdown(expenses: Expense[]): ExpenseBreakdown[] {
  const total = expenses.reduce((sum, e) => sum + monthlyEquivalent(e), 0)

  return expenses
    .map((e) => {
      const monthly = monthlyEquivalent(e)
      return {
        id: e._id,
        name: e.name.trim() || "Bez názvu",
        period: e.period,
        monthly: round2(monthly),
        share: total > 0 ? round2((monthly / total) * 100) : 0,
      }
    })
    .sort((a, b) => b.monthly - a.monthly)
}

// --- Checklist plateb ---------------------------------------------------------
// Ručně placené měsíční výdaje si uživatel každý měsíc odškrtává. Měsíce se
// klíčují jako `yyyy-mm` v lokálním čase (porovnatelné jako řetězce).

/** Klíč měsíce `yyyy-mm` v lokálním čase. */
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export interface ChecklistItem {
  id: ChecklistItemId
  name: string
  amount: number
  /** Měsíc zařazení do checklistu; `null` = položka v checklistu není. */
  since: string | null
}

/**
 * Výdaje, které jde odškrtávat: měsíční výdaje + paušální daň (pokud je
 * nastavená). Roční výdaje se do měsíčního checklistu nehodí.
 */
export function checklistCandidates(
  expenses: Expense[],
  flatTaxMonthly: number,
  flatTaxChecklistSince: string | undefined
): ChecklistItem[] {
  const items: ChecklistItem[] = expenses
    .filter((e) => e.period === "monthly")
    .map((e) => ({
      id: e._id,
      name: e.name.trim() || "Bez názvu",
      amount: e.amount,
      since: e.checklistSince ?? null,
    }))
  if (flatTaxMonthly > 0) {
    items.unshift({
      id: "flatTax",
      name: "Paušální daň",
      amount: flatTaxMonthly,
      since: flatTaxChecklistSince ?? null,
    })
  }
  return items
}

/** Položky checklistu, které se v daném měsíci mají platit. */
export function itemsForMonth(
  items: ChecklistItem[],
  month: string
): ChecklistItem[] {
  return items.filter((i) => i.since !== null && i.since <= month)
}

/** Mapa `item|month` → platba, pro rychlé dohledání v renderu. */
export function paymentIndex(
  payments: ExpensePayment[]
): Map<string, ExpensePayment> {
  return new Map(payments.map((p) => [`${p.item}|${p.month}`, p]))
}

export function paymentKey(item: ChecklistItemId, month: string): string {
  return `${item}|${month}`
}

export interface ChecklistMonthStatus {
  month: string
  total: number
  paid: number
  /** Celková částka k zaplacení v měsíci. */
  amount: number
  /** Zbývající částka k zaplacení. */
  remaining: number
}

/** Stav zaplacení checklistu v daném měsíci. */
export function checklistMonthStatus(
  items: ChecklistItem[],
  index: Map<string, ExpensePayment>,
  month: string
): ChecklistMonthStatus {
  const due = itemsForMonth(items, month)
  let paid = 0
  let amount = 0
  let remaining = 0
  for (const item of due) {
    amount += item.amount
    if (index.has(paymentKey(item.id, month))) paid += 1
    else remaining += item.amount
  }
  return {
    month,
    total: due.length,
    paid,
    amount: round2(amount),
    remaining: round2(remaining),
  }
}
