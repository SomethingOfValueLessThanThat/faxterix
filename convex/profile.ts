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
  flatTaxChecklistSince: v.optional(v.string()),
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

// Zapnutí/vypnutí paušální daně v checklistu plateb. Samostatná mutace, ať se
// kvůli jednomu poli nemusí posílat (a přepisovat) celý profil.
export const setFlatTaxChecklist = mutation({
  args: { since: v.union(v.string(), v.null()) },
  handler: async (ctx, { since }) => {
    const existing = await ctx.db.query("profile").first()
    if (!existing) throw new Error("Profil zatím neexistuje.")
    await ctx.db.patch(existing._id, {
      flatTaxChecklistSince: since ?? undefined,
    })
  },
})
