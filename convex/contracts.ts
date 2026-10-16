import {
  query,
  mutation,
  internalMutation,
  type MutationCtx,
} from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"
import { contractTermsValidator } from "./schema"

// Trezor smluv: nahrání PDF do storage, AI výtah podmínek na pozadí
// (`contractsAi.extract`) a ruční úpravy vytažených údajů.

// --- Čtení ------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_createdAt")
      .order("desc")
      .collect()
    return await Promise.all(
      contracts.map(async (c) => ({
        ...c,
        fileUrl: await ctx.storage.getUrl(c.fileId),
      }))
    )
  },
})

// --- Zápis ------------------------------------------------------------------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

async function scheduleExtraction(
  ctx: MutationCtx,
  id: Id<"contracts">,
  fileId: Id<"_storage">
) {
  await ctx.scheduler.runAfter(0, internal.contractsAi.extract, { id, fileId })
}

export const create = mutation({
  args: { fileId: v.id("_storage"), fileName: v.string() },
  handler: async (ctx, { fileId, fileName }) => {
    const now = Date.now()
    const id = await ctx.db.insert("contracts", {
      // Dočasný název, než AI navrhne lepší.
      title: fileName.replace(/\.pdf$/i, ""),
      fileId,
      fileName,
      clientId: null,
      extraction: "pending",
      createdAt: now,
      updatedAt: now,
    })
    await scheduleExtraction(ctx, id, fileId)
    return id
  },
})

export const retryExtraction = mutation({
  args: { id: v.id("contracts") },
  handler: async (ctx, { id }) => {
    const contract = await ctx.db.get(id)
    if (!contract) return
    await ctx.db.patch(id, {
      extraction: "pending",
      extractionError: undefined,
      updatedAt: Date.now(),
    })
    await scheduleExtraction(ctx, id, contract.fileId)
  },
})

export const patch = mutation({
  args: {
    id: v.id("contracts"),
    title: v.optional(v.string()),
    clientId: v.optional(v.union(v.id("clients"), v.null())),
    terms: v.optional(contractTermsValidator),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, { ...rest, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id("contracts") },
  handler: async (ctx, { id }) => {
    const contract = await ctx.db.get(id)
    if (!contract) return
    await ctx.storage.delete(contract.fileId)
    await ctx.db.delete(id)
  },
})

// --- Výsledek AI výtahu -----------------------------------------------------

export const applyExtraction = internalMutation({
  args: {
    id: v.id("contracts"),
    title: v.string(),
    terms: contractTermsValidator,
  },
  handler: async (ctx, { id, title, terms }) => {
    // Smlouva mohla být mezitím smazána.
    const contract = await ctx.db.get(id)
    if (!contract) return
    // Protistranu spárujeme s adresářem podle IČO; ručně zvoleného klienta
    // (např. při opakovaném výtahu) nepřepisujeme.
    let clientId = contract.clientId
    const ico = terms.counterpartyIco?.replace(/\s/g, "")
    if (!clientId && ico) {
      const clients = await ctx.db.query("clients").collect()
      clientId =
        clients.find((c) => c.ico.replace(/\s/g, "") === ico)?._id ?? null
    }
    await ctx.db.patch(id, {
      title,
      terms,
      clientId,
      extraction: "done",
      extractionError: undefined,
      updatedAt: Date.now(),
    })
  },
})

export const failExtraction = internalMutation({
  args: { id: v.id("contracts"), error: v.string() },
  handler: async (ctx, { id, error }) => {
    const contract = await ctx.db.get(id)
    if (!contract) return
    await ctx.db.patch(id, {
      extraction: "failed",
      extractionError: error,
      updatedAt: Date.now(),
    })
  },
})
