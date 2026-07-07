import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

// Convex schéma zrcadlí doménové typy v `lib/types.ts`. Convex automaticky
// přidává `_id` a `_creationTime`; `createdAt`/`updatedAt` si držíme zvlášť kvůli
// kompatibilitě se stávajícím datovým modelem a importem.

export const addressValidator = v.object({
  street: v.string(),
  city: v.string(),
  zip: v.string(),
  country: v.string(),
})

export const clientSnapshotValidator = v.object({
  name: v.string(),
  ico: v.string(),
  dic: v.string(),
  email: v.string(),
  address: addressValidator,
})

export const invoiceItemValidator = v.object({
  id: v.string(),
  description: v.string(),
  quantity: v.number(),
  unit: v.string(),
  unitPrice: v.number(),
  vatRate: v.number(),
})

export default defineSchema({
  clients: defineTable({
    name: v.string(),
    ico: v.string(),
    dic: v.string(),
    email: v.string(),
    address: addressValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  invoices: defineTable({
    number: v.string(),
    clientId: v.union(v.id("clients"), v.null()),
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
    .index("by_issueDate", ["issueDate"])
    .index("by_variableSymbol", ["variableSymbol"]),

  // Pravidelné výdaje (měsíční / roční). Přepočet na měsíc se počítá v UI.
  expenses: defineTable({
    name: v.string(),
    amount: v.number(),
    period: v.union(v.literal("monthly"), v.literal("yearly")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  // Profil firmy je singleton – v tabulce drží jediný dokument.
  profile: defineTable({
    name: v.string(),
    ico: v.string(),
    dic: v.string(),
    vatPayer: v.boolean(),
    address: addressValidator,
    email: v.string(),
    phone: v.string(),
    iban: v.optional(v.string()),
    bankAccount: v.string(),
    dueDays: v.number(),
    numberFormat: v.string(),
    selectedBand: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3))),
    bandLimits: v.optional(v.array(v.number())),
    flatTaxMonthly: v.optional(v.number()),
  }),
})
