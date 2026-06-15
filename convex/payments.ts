import { internalMutation } from "./_generated/server"
import { v } from "convex/values"
import { computeTotals, round2 } from "../lib/invoice"

// Párování příchozí bankovní platby na fakturu. Voláno z webhooku
// (`convex/http.ts`) jako interní mutace – není součástí veřejného API.

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
  },
  handler: async (ctx, { vs, amount }) => {
    const candidates = await ctx.db
      .query("invoices")
      .withIndex("by_variableSymbol", (q) => q.eq("variableSymbol", vs))
      .take(20)

    if (candidates.length === 0) {
      return { status: "no_invoice" as ApplyPaymentStatus }
    }

    const profile = await ctx.db.query("profile").first()
    const vatPayer = profile?.vatPayer ?? false
    const matchesAmount = (items: typeof candidates[number]["items"]) =>
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
    await ctx.db.patch(invoice._id, { status: "paid", updatedAt: Date.now() })
    return { status: "matched" as ApplyPaymentStatus, invoiceId: invoice._id }
  },
})
