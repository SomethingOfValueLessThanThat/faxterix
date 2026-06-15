"use client"

// Datová vrstva nad Convex. Čtení přes `useQuery`, zápis přes `useMutation`
// zabalený do malých „api" hooků (useClientApi/useInvoiceApi/…), aby volání ve
// komponentách zůstala čitelná. Tvar hooků kopíruje původní lokální store.

import * as React from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { Client, Invoice, CompanyProfile } from "./types"
import { emptyAddress } from "./types"

const defaultProfile: CompanyProfile = {
  name: "",
  ico: "",
  dic: "",
  vatPayer: false,
  address: emptyAddress(),
  email: "",
  phone: "",
  bankAccount: "",
  dueDays: 14,
  numberFormat: "{YYYY}{NNNN}",
  selectedBand: 1,
  bandLimits: [1_000_000, 1_500_000, 2_000_000],
  flatTaxMonthly: 0,
}

// --- Klienti ---------------------------------------------------------------

export function useClients(): Client[] {
  return useQuery(api.clients.list) ?? []
}

export function useClient(id: string | null | undefined): Client | undefined {
  const client = useQuery(
    api.clients.get,
    id ? { id: id as Id<"clients"> } : "skip"
  )
  return client ?? undefined
}

type ClientInput = Omit<Client, "_id" | "createdAt" | "updatedAt">

export function useClientApi() {
  const create = useMutation(api.clients.create)
  const patch = useMutation(api.clients.patch)
  const remove = useMutation(api.clients.remove)

  return React.useMemo(
    () => ({
      create: (data: ClientInput) => create(data),
      patch: (id: string, data: Partial<ClientInput>) =>
        patch({ id: id as Id<"clients">, ...data }),
      remove: (id: string) => remove({ id: id as Id<"clients"> }),
    }),
    [create, patch, remove]
  )
}

// --- Faktury ---------------------------------------------------------------

export function useInvoices(): Invoice[] {
  // Query vrací faktury seřazené podle data vystavení (nejnovější nahoře).
  return useQuery(api.invoices.list) ?? []
}

export function useInvoice(id: string | null | undefined): Invoice | undefined {
  const invoice = useQuery(
    api.invoices.get,
    id ? { id: id as Id<"invoices"> } : "skip"
  )
  return invoice ?? undefined
}

// Vybere jen pole, která se ukládají (bez _id/_creationTime/timestamps).
function invoicePayload(inv: Invoice) {
  return {
    number: inv.number,
    clientId: (inv.clientId as Id<"clients"> | null) ?? null,
    client: inv.client,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    taxDate: inv.taxDate,
    items: inv.items,
    status: inv.status,
    note: inv.note,
    variableSymbol: inv.variableSymbol,
    paymentMethod: inv.paymentMethod,
  }
}

export function useInvoiceApi() {
  const create = useMutation(api.invoices.create)
  const patch = useMutation(api.invoices.patch)
  const remove = useMutation(api.invoices.remove)

  return React.useMemo(
    () => ({
      create: (data: Invoice) => create(invoicePayload(data)),
      patch: (id: string, data: Invoice) =>
        patch({ id: id as Id<"invoices">, ...invoicePayload(data) }),
      remove: (id: string) => remove({ id: id as Id<"invoices"> }),
    }),
    [create, patch, remove]
  )
}

// --- Hromadný import -------------------------------------------------------

export function useDataApi() {
  const importDataMut = useMutation(api.data.importData)

  return React.useMemo(
    () => ({
      importData: (clients: Client[], invoices: Invoice[]) =>
        importDataMut({
          clients,
          invoices: invoices.map((inv) => ({
            ...inv,
            clientId: inv.clientId ?? null,
          })),
        }),
    }),
    [importDataMut]
  )
}

// --- Profil firmy ----------------------------------------------------------

export function useProfile(): CompanyProfile {
  const raw = useQuery(api.profile.get)
  // Memoizujeme, aby byl profil referenčně stabilní (useQuery vrací stabilní
  // `raw`); jinak by každý render vytvořil nový objekt a rozbil porovnání.
  return React.useMemo(() => {
    if (!raw) return defaultProfile
    return {
      ...defaultProfile,
      ...raw,
      bandLimits: raw.bandLimits ?? defaultProfile.bandLimits,
      selectedBand: raw.selectedBand ?? defaultProfile.selectedBand,
      flatTaxMonthly: raw.flatTaxMonthly ?? defaultProfile.flatTaxMonthly,
    }
  }, [raw])
}

export function useProfileApi() {
  const save = useMutation(api.profile.save)

  return React.useMemo(
    () => ({
      save: (profile: CompanyProfile) =>
        save({
          name: profile.name,
          ico: profile.ico,
          dic: profile.dic,
          vatPayer: profile.vatPayer,
          address: profile.address,
          email: profile.email,
          phone: profile.phone,
          bankAccount: profile.bankAccount,
          dueDays: profile.dueDays,
          numberFormat: profile.numberFormat,
          selectedBand: profile.selectedBand,
          bandLimits: profile.bandLimits,
          flatTaxMonthly: profile.flatTaxMonthly,
        }),
    }),
    [save]
  )
}
