"use client"

// Datová vrstva nad Convex. Čtení přes `useQuery`, zápis přes `useMutation`
// zabalený do malých „api" hooků (useClientApi/useInvoiceApi/…), aby volání ve
// komponentách zůstala čitelná. Tvar hooků kopíruje původní lokální store.

import * as React from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type {
  ChecklistItemId,
  Client,
  Contract,
  ContractTerms,
  Invoice,
  CompanyProfile,
  Expense,
  ExpensePayment,
  Passkey,
} from "./types"
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
    // Datum úhrady dává smysl jen u zaplacené faktury; `null` ho při patchi smaže.
    paidDate: inv.status === "paid" ? (inv.paidDate ?? null) : null,
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

// --- Výdaje ----------------------------------------------------------------

export function useExpenses(): Expense[] {
  return useQuery(api.expenses.list) ?? []
}

/** Odškrtnuté platby checklistu od daného měsíce (yyyy-mm) dál. */
export function useExpensePayments(fromMonth: string): ExpensePayment[] {
  return useQuery(api.expenses.payments, { fromMonth }) ?? []
}

type ExpenseInput = Omit<
  Expense,
  "_id" | "createdAt" | "updatedAt" | "checklistSince"
>

export function useExpenseApi() {
  const create = useMutation(api.expenses.create)
  const patch = useMutation(api.expenses.patch)
  const remove = useMutation(api.expenses.remove)
  const setPaidMut = useMutation(api.expenses.setPaid)
  const setFlatTaxChecklist = useMutation(api.profile.setFlatTaxChecklist)

  return React.useMemo(
    () => ({
      create: (data: ExpenseInput & { checklistSince?: string }) =>
        create(data),
      patch: (
        id: string,
        data: Partial<ExpenseInput> & { checklistSince?: string | null }
      ) => patch({ id: id as Id<"expenses">, ...data }),
      remove: (id: string) => remove({ id: id as Id<"expenses"> }),
      /** `since` = měsíc zařazení do checklistu, `null` = vyřadit. */
      setChecklist: (item: ChecklistItemId, since: string | null) =>
        item === "flatTax"
          ? setFlatTaxChecklist({ since })
          : patch({ id: item as Id<"expenses">, checklistSince: since }),
      setPaid: (item: ChecklistItemId, month: string, paid: boolean) =>
        setPaidMut({
          item: item === "flatTax" ? item : (item as Id<"expenses">),
          month,
          paid,
        }),
    }),
    [create, patch, remove, setPaidMut, setFlatTaxChecklist]
  )
}

// --- Smlouvy ---------------------------------------------------------------

export function useContracts(): Contract[] {
  return useQuery(api.contracts.list) ?? []
}

export function useContractApi() {
  const generateUploadUrl = useMutation(api.contracts.generateUploadUrl)
  const create = useMutation(api.contracts.create)
  const patch = useMutation(api.contracts.patch)
  const remove = useMutation(api.contracts.remove)
  const retry = useMutation(api.contracts.retryExtraction)

  return React.useMemo(
    () => ({
      /** Nahraje PDF do storage a založí smlouvu; AI výtah poběží na pozadí. */
      upload: async (file: File) => {
        const url = await generateUploadUrl()
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        })
        if (!res.ok) throw new Error("Nahrání souboru selhalo.")
        const { storageId } = (await res.json()) as { storageId: string }
        return create({
          fileId: storageId as Id<"_storage">,
          fileName: file.name,
        })
      },
      patch: (
        id: string,
        data: {
          title?: string
          clientId?: string | null
          terms?: ContractTerms
        }
      ) =>
        patch({
          id: id as Id<"contracts">,
          title: data.title,
          clientId:
            data.clientId === undefined
              ? undefined
              : (data.clientId as Id<"clients"> | null),
          terms: data.terms,
        }),
      remove: (id: string) => remove({ id: id as Id<"contracts"> }),
      retry: (id: string) => retry({ id: id as Id<"contracts"> }),
    }),
    [generateUploadUrl, create, patch, remove, retry]
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
          flatTaxChecklistSince: profile.flatTaxChecklistSince,
        }),
    }),
    [save]
  )
}

// --- Passkeys --------------------------------------------------------------

export function usePasskeys(): Passkey[] {
  return useQuery(api.passkeys.list) ?? []
}

export function usePasskeyApi() {
  const remove = useMutation(api.passkeys.remove)

  return React.useMemo(
    () => ({
      remove: (id: string) => remove({ id: id as Id<"passkeys"> }),
    }),
    [remove]
  )
}
