import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

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

// --- Zápis ------------------------------------------------------------------

const periodValidator = v.union(v.literal("monthly"), v.literal("yearly"))

export const create = mutation({
  args: {
    name: v.string(),
    amount: v.number(),
    period: periodValidator,
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
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, { ...rest, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})
