import { mutation } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import {
  addressValidator,
  clientSnapshotValidator,
  invoiceItemValidator,
} from "./schema"

// Hromadný import (např. z CSV Fakturoidu). Klienti přicházejí s dočasným
// `_id` (UUID vygenerovaným při parsování); faktury na něj odkazují přes
// `clientId`. Tady klienty vložíme, získáme jejich skutečná Convex `_id`
// a v fakturách dočasné odkazy přemapujeme.

const incomingClient = v.object({
  _id: v.string(),
  name: v.string(),
  ico: v.string(),
  dic: v.string(),
  email: v.string(),
  address: addressValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
})

const incomingInvoice = v.object({
  _id: v.string(),
  number: v.string(),
  clientId: v.union(v.string(), v.null()),
  client: v.union(clientSnapshotValidator, v.null()),
  issueDate: v.string(),
  dueDate: v.string(),
  taxDate: v.string(),
  items: v.array(invoiceItemValidator),
  status: v.union(v.literal("draft"), v.literal("sent"), v.literal("paid")),
  note: v.string(),
  variableSymbol: v.string(),
  paymentMethod: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const importData = mutation({
  args: {
    clients: v.array(incomingClient),
    invoices: v.array(incomingInvoice),
  },
  handler: async (ctx, { clients, invoices }) => {
    // Dočasné `_id` → skutečné Convex id nově vložených klientů.
    const idMap = new Map<string, Id<"clients">>()
    for (const c of clients) {
      const { _id, ...fields } = c
      const newId = await ctx.db.insert("clients", fields)
      idMap.set(_id, newId)
    }

    for (const inv of invoices) {
      const { _id, clientId, ...fields } = inv
      const mapped =
        clientId && idMap.has(clientId)
          ? idMap.get(clientId)!
          : (clientId as Id<"clients"> | null)
      await ctx.db.insert("invoices", { ...fields, clientId: mapped })
    }
  },
})
