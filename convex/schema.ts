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

export const checklistItemValidator = v.union(
  v.id("expenses"),
  v.literal("flatTax")
)

// Podmínky smlouvy vytažené AI (a případně opravené ručně). Data jsou ISO
// yyyy-mm-dd; chybějící údaj = ve smlouvě není.
export const contractTermsValidator = v.object({
  counterparty: v.string(),
  counterpartyIco: v.optional(v.string()),
  summary: v.string(),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  autoRenewal: v.boolean(),
  // O kolik měsíců se smlouva automaticky prodlužuje.
  renewalMonths: v.optional(v.number()),
  notice: v.optional(
    v.object({
      amount: v.number(),
      unit: v.union(v.literal("days"), v.literal("months")),
    })
  ),
  rate: v.optional(v.string()),
  paymentDays: v.optional(v.number()),
  confidentialityUntil: v.optional(v.string()),
  keyPoints: v.array(v.string()),
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
    // Datum úhrady (yyyy-mm-dd), jen u zaplacených. Paušální režim počítá
    // příjmy podle data přijetí peněz, ne podle data vystavení.
    paidDate: v.optional(v.string()),
    note: v.string(),
    variableSymbol: v.string(),
    paymentMethod: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_issueDate", ["issueDate"])
    .index("by_variableSymbol", ["variableSymbol"]),

  // Pravidelné výdaje (měsíční / roční). Přepočet na měsíc se počítá v UI.
  // `checklistSince` (yyyy-mm) = výdaj se platí ručně a odškrtává se v měsíčním
  // checklistu; měsíce před tímto datem se nepočítají jako nezaplacené.
  expenses: defineTable({
    name: v.string(),
    amount: v.number(),
    period: v.union(v.literal("monthly"), v.literal("yearly")),
    checklistSince: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  // Odškrtnuté platby z checklistu – jeden dokument = položka zaplacená v daném
  // měsíci. Paušální daň nemá vlastní dokument výdaje, proto literál "flatTax".
  expensePayments: defineTable({
    item: checklistItemValidator,
    month: v.string(), // yyyy-mm
    paidAt: v.number(),
    // "bank" = odškrtnuto automaticky z bankovní notifikace (párování podle
    // částky); chybí = odškrtnuto ručně.
    source: v.optional(v.literal("bank")),
  })
    .index("by_month", ["month"])
    .index("by_item_and_month", ["item", "month"]),

  // Passkeys (Touch ID) pro přihlášení. Veřejný klíč je base64url, `counter`
  // chrání proti replay (Apple ho ale drží na 0).
  passkeys: defineTable({
    credentialId: v.string(),
    publicKey: v.string(),
    counter: v.number(),
    transports: v.optional(v.array(v.string())),
    name: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  }).index("by_credentialId", ["credentialId"]),

  // Trezor smluv. Soubor (PDF) leží v Convex storage; `terms` doplní AI výtah
  // na pozadí – do té doby (a při chybě) chybí.
  contracts: defineTable({
    title: v.string(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    clientId: v.union(v.id("clients"), v.null()),
    extraction: v.union(
      v.literal("pending"),
      v.literal("done"),
      v.literal("failed")
    ),
    extractionError: v.optional(v.string()),
    terms: v.optional(contractTermsValidator),
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
    flatTaxChecklistSince: v.optional(v.string()),
  }),
})
