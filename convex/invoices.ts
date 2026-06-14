import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { clientSnapshotValidator, invoiceItemValidator } from "./schema"

// --- Čtení ------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Nejnovější (podle data vystavení) nahoře.
    return await ctx.db
      .query("invoices")
      .withIndex("by_issueDate")
      .order("desc")
      .collect()
  },
})

export const get = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})

// --- Zápis ------------------------------------------------------------------

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("paid")
)

const invoiceFields = {
  number: v.string(),
  clientId: v.union(v.id("clients"), v.null()),
  client: v.union(clientSnapshotValidator, v.null()),
  issueDate: v.string(),
  dueDate: v.string(),
  taxDate: v.string(),
  items: v.array(invoiceItemValidator),
  status: statusValidator,
  note: v.string(),
  variableSymbol: v.string(),
  paymentMethod: v.string(),
}

export const create = mutation({
  args: invoiceFields,
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("invoices", {
      ...args,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const patch = mutation({
  args: {
    id: v.id("invoices"),
    number: v.optional(v.string()),
    clientId: v.optional(v.union(v.id("clients"), v.null())),
    client: v.optional(v.union(clientSnapshotValidator, v.null())),
    issueDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    taxDate: v.optional(v.string()),
    items: v.optional(v.array(invoiceItemValidator)),
    status: v.optional(statusValidator),
    note: v.optional(v.string()),
    variableSymbol: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, { ...rest, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})
