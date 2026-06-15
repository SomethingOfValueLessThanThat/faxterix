import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { addressValidator } from "./schema"

// Profil firmy je singleton – tabulka `profile` drží nanejvýš jeden dokument.

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("profile").first()
  },
})

const profileFields = {
  name: v.string(),
  ico: v.string(),
  dic: v.string(),
  vatPayer: v.boolean(),
  address: addressValidator,
  email: v.string(),
  phone: v.string(),
  bankAccount: v.string(),
  dueDays: v.number(),
  numberFormat: v.string(),
  selectedBand: v.union(v.literal(1), v.literal(2), v.literal(3)),
  bandLimits: v.array(v.number()),
  flatTaxMonthly: v.optional(v.number()),
}

export const save = mutation({
  args: profileFields,
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("profile").first()
    if (existing) {
      await ctx.db.replace(existing._id, args)
      return existing._id
    }
    return await ctx.db.insert("profile", args)
  },
})
