import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { addressValidator } from "./schema"

// --- Čtení ------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("clients").collect()
  },
})

export const get = query({
  args: { id: v.id("clients") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})

// --- Zápis ------------------------------------------------------------------

const clientFields = {
  name: v.string(),
  ico: v.string(),
  dic: v.string(),
  email: v.string(),
  address: addressValidator,
}

export const create = mutation({
  args: clientFields,
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("clients", {
      ...args,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const patch = mutation({
  args: {
    id: v.id("clients"),
    name: v.optional(v.string()),
    ico: v.optional(v.string()),
    dic: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(addressValidator),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, { ...rest, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id("clients") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})
