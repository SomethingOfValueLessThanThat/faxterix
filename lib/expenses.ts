// Agregace nad pravidelnými výdaji pro stránku /expenses. Čisté funkce bez
// Reactu/Convexu, aby šly snadno testovat i znovu použít. Roční výdaje se pro
// „měsíční přepočet" dělí dvanácti.

import type { Expense } from "./types"
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
