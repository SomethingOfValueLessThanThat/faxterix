import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { checklistItemValidator } from "./schema"

// --- Čtení ------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Nejstarší nahoře, ať se pořadí položek nemění při editaci.
    return await ctx.db
      .query("expenses")
      .withIndex("by_createdAt")
      .order("asc")
      .collect()
  },
})

/** Odškrtnuté platby od daného měsíce (yyyy-mm) dál. */
export const payments = query({
  args: { fromMonth: v.string() },
  handler: async (ctx, { fromMonth }) => {
    return await ctx.db
      .query("expensePayments")
      .withIndex("by_month", (q) => q.gte("month", fromMonth))
      .collect()
  },
})

// --- Zápis ------------------------------------------------------------------

const periodValidator = v.union(v.literal("monthly"), v.literal("yearly"))

export const create = mutation({
  args: {
    name: v.string(),
    amount: v.number(),
    period: periodValidator,
    checklistSince: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("expenses", {
      ...args,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const patch = mutation({
  args: {
    id: v.id("expenses"),
    name: v.optional(v.string()),
    amount: v.optional(v.number()),
    period: v.optional(periodValidator),
    // `null` = vyřadit z checklistu (undefined klient neumí poslat).
    checklistSince: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, checklistSince, ...rest }) => {
    await ctx.db.patch(id, {
      ...rest,
      ...(checklistSince !== undefined && {
        checklistSince: checklistSince ?? undefined,
      }),
      updatedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, { id }) => {
    const payments = await ctx.db
      .query("expensePayments")
      .withIndex("by_item_and_month", (q) => q.eq("item", id))
      .collect()
    for (const p of payments) await ctx.db.delete(p._id)
    await ctx.db.delete(id)
  },
})

/** Odškrtne / zruší platbu položky v daném měsíci. Idempotentní. */
export const setPaid = mutation({
  args: {
    item: checklistItemValidator,
    month: v.string(),
    paid: v.boolean(),
  },
  handler: async (ctx, { item, month, paid }) => {
    const existing = await ctx.db
      .query("expensePayments")
      .withIndex("by_item_and_month", (q) =>
        q.eq("item", item).eq("month", month)
      )
      .unique()
    if (paid && !existing) {
      await ctx.db.insert("expensePayments", {
        item,
        month,
        paidAt: Date.now(),
      })
    } else if (!paid && existing) {
      await ctx.db.delete(existing._id)
    }
  },
})
