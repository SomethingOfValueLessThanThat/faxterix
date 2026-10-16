import { internalMutation } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { computeTotals, round2 } from "../lib/invoice"
import { checklistCandidates, itemsForMonth } from "../lib/expenses"

// Párování bankovních plateb: příchozí → faktura (VS + částka), odchozí →
// položka checklistu výdajů (jen částka). Voláno z webhooku (`convex/http.ts`)
// jako interní mutace – není součástí veřejného API.

export type ApplyPaymentStatus =
  | "matched" // faktura nalezena podle VS + částky a přepnuta na „paid"
  | "already_paid" // faktura už byla zaplacená (idempotence při retry)
  | "amount_mismatch" // VS sedí, ale částka neodpovídá žádné nezaplacené faktuře
  | "ambiguous" // víc nezaplacených faktur se stejným VS i částkou
  | "no_invoice" // žádná faktura s tímto VS

/**
 * Najde fakturu podle variabilního symbolu, ověří, že připsaná částka odpovídá
 * její celkové sumě, a označí ji jako zaplacenou. Vrací výsledek párování.
 */
export const applyIncomingPayment = internalMutation({
  args: {
    vs: v.string(),
    amount: v.number(),
    paidDate: v.string(), // yyyy-mm-dd
  },
  handler: async (ctx, { vs, amount, paidDate }) => {
    const candidates = await ctx.db
      .query("invoices")
      .withIndex("by_variableSymbol", (q) => q.eq("variableSymbol", vs))
      .take(20)

    if (candidates.length === 0) {
      return { status: "no_invoice" as ApplyPaymentStatus }
    }

    const profile = await ctx.db.query("profile").first()
    const vatPayer = profile?.vatPayer ?? false
    const matchesAmount = (items: (typeof candidates)[number]["items"]) =>
      round2(computeTotals(items, vatPayer).total) === round2(amount)

    // Idempotence: platba už dorazila dřív a faktura je zaplacená.
    const alreadyPaid = candidates.find(
      (inv) => inv.status === "paid" && matchesAmount(inv.items)
    )
    if (alreadyPaid) {
      return {
        status: "already_paid" as ApplyPaymentStatus,
        invoiceId: alreadyPaid._id,
      }
    }

    const unpaidMatches = candidates.filter(
      (inv) => inv.status !== "paid" && matchesAmount(inv.items)
    )
    if (unpaidMatches.length === 0) {
      return { status: "amount_mismatch" as ApplyPaymentStatus }
    }
    if (unpaidMatches.length > 1) {
      return { status: "ambiguous" as ApplyPaymentStatus }
    }

    const invoice = unpaidMatches[0]
    await ctx.db.patch(invoice._id, {
      status: "paid",
      paidDate,
      updatedAt: Date.now(),
    })
    return { status: "matched" as ApplyPaymentStatus, invoiceId: invoice._id }
  },
})

export type ApplyOutgoingStatus =
  | "matched" // položka checklistu odškrtnuta
  | "already_paid" // všechny položky s touto částkou už jsou v měsíci zaplacené
  | "no_item" // žádná položka checklistu s touto částkou

/**
 * Odchozí platba → odškrtne položku checklistu se stejnou částkou v měsíci
 * platby. Víc položek se stejnou částkou se odškrtává postupně (první
 * nezaplacená), takže dvě platby po 550 Kč pokryjí dvě položky po 550 Kč.
 */
export const applyOutgoingPayment = internalMutation({
  args: {
    amount: v.number(),
    month: v.string(), // yyyy-mm
    paidAt: v.number(),
  },
  handler: async (ctx, { amount, month, paidAt }) => {
    const [expenses, profile] = await Promise.all([
      ctx.db.query("expenses").withIndex("by_createdAt").collect(),
      ctx.db.query("profile").first(),
    ])
    const items = itemsForMonth(
      checklistCandidates(
        expenses,
        profile?.flatTaxMonthly ?? 0,
        profile?.flatTaxChecklistSince
      ),
      month
    ).filter((item) => round2(item.amount) === round2(amount))

    if (items.length === 0) {
      return { status: "no_item" as ApplyOutgoingStatus }
    }

    for (const item of items) {
      const id = item.id as Id<"expenses"> | "flatTax"
      const existing = await ctx.db
        .query("expensePayments")
        .withIndex("by_item_and_month", (q) =>
          q.eq("item", id).eq("month", month)
        )
        .unique()
      if (existing) continue
      await ctx.db.insert("expensePayments", {
        item: id,
        month,
        paidAt,
        source: "bank",
      })
      return { status: "matched" as ApplyOutgoingStatus, item: item.name }
    }
    return { status: "already_paid" as ApplyOutgoingStatus }
  },
})
