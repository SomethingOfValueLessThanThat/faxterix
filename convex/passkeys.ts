import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// Passkeys pro přihlášení bez hesla. Ověření WebAuthn probíhá v Next API
// routách (`app/api/passkey/*`), Convex jen drží uložené credentials.

// --- Čtení ------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    const passkeys = await ctx.db.query("passkeys").order("asc").collect()
    return passkeys.map(({ _id, name, createdAt, lastUsedAt }) => ({
      _id,
      name,
      createdAt,
      lastUsedAt,
    }))
  },
})

export const listCredentialIds = query({
  args: {},
  handler: async (ctx) => {
    const passkeys = await ctx.db.query("passkeys").collect()
    return passkeys.map((p) => ({
      credentialId: p.credentialId,
      transports: p.transports,
    }))
  },
})

export const getByCredentialId = query({
  args: { credentialId: v.string() },
  handler: async (ctx, { credentialId }) => {
    return await ctx.db
      .query("passkeys")
      .withIndex("by_credentialId", (q) => q.eq("credentialId", credentialId))
      .unique()
  },
})

// --- Zápis ------------------------------------------------------------------

export const create = mutation({
  args: {
    credentialId: v.string(),
    publicKey: v.string(),
    counter: v.number(),
    transports: v.optional(v.array(v.string())),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("passkeys", { ...args, createdAt: Date.now() })
  },
})

export const markUsed = mutation({
  args: { credentialId: v.string(), counter: v.number() },
  handler: async (ctx, { credentialId, counter }) => {
    const passkey = await ctx.db
      .query("passkeys")
      .withIndex("by_credentialId", (q) => q.eq("credentialId", credentialId))
      .unique()
    if (!passkey) return
    await ctx.db.patch(passkey._id, { counter, lastUsedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id("passkeys") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})
