"use client"

// Lokální „mock" backend nad localStorage s reaktivním čtením přes
// useSyncExternalStore. API (useClients, useInvoices, useProfile) je záměrně
// tvarováno jako Convex hooky, aby se dal backend později vyměnit za Convex.

import * as React from "react"
import type { Client, Invoice, CompanyProfile } from "./types"
import { emptyAddress } from "./types"

const STORAGE_KEY = "faxterix:v1"

interface DbShape {
  clients: Client[]
  invoices: Invoice[]
  profile: CompanyProfile
}

const defaultProfile: CompanyProfile = {
  name: "",
  ico: "",
  dic: "",
  vatPayer: false,
  address: emptyAddress(),
  email: "",
  phone: "",
  iban: "",
  bankAccount: "",
  dueDays: 14,
  numberFormat: "{YYYY}{NNNN}",
}

function emptyDb(): DbShape {
  return { clients: [], invoices: [], profile: defaultProfile }
}

// --- jednoduchý externí store ---------------------------------------------

let memory: DbShape | null = null
// Stabilní reference pro server snapshot (jinak useSyncExternalStore cyklí).
const SERVER_SNAPSHOT: DbShape = emptyDb()
const listeners = new Set<() => void>()

function read(): DbShape {
  if (memory) return memory
  if (typeof window === "undefined") {
    memory = emptyDb()
    return memory
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    memory = raw ? { ...emptyDb(), ...JSON.parse(raw) } : emptyDb()
  } catch {
    memory = emptyDb()
  }
  return memory as DbShape
}

function write(next: DbShape) {
  memory = next
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // synchronizace mezi záložkami
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      memory = null
      listener()
    }
  }
  if (typeof window !== "undefined")
    window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    if (typeof window !== "undefined")
      window.removeEventListener("storage", onStorage)
  }
}

function useDb(): DbShape {
  return React.useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT)
}

function update(mutator: (db: DbShape) => DbShape) {
  write(mutator(read()))
}

const now = () => Date.now()
const newId = () => crypto.randomUUID()

// --- Klienti ---------------------------------------------------------------

export function useClients(): Client[] {
  return useDb().clients
}

export function useClient(id: string | null | undefined): Client | undefined {
  const clients = useClients()
  return React.useMemo(() => clients.find((c) => c._id === id), [clients, id])
}

export const clientApi = {
  create(data: Omit<Client, "_id" | "createdAt" | "updatedAt">): string {
    const id = newId()
    update((db) => ({
      ...db,
      clients: [
        ...db.clients,
        { ...data, _id: id, createdAt: now(), updatedAt: now() },
      ],
    }))
    return id
  },
  patch(id: string, data: Partial<Client>) {
    update((db) => ({
      ...db,
      clients: db.clients.map((c) =>
        c._id === id ? { ...c, ...data, updatedAt: now() } : c
      ),
    }))
  },
  remove(id: string) {
    update((db) => ({
      ...db,
      clients: db.clients.filter((c) => c._id !== id),
    }))
  },
}

// --- Faktury ---------------------------------------------------------------

export function useInvoices(): Invoice[] {
  const invoices = useDb().invoices
  return React.useMemo(
    () => [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate)),
    [invoices]
  )
}

export function useInvoice(id: string | null | undefined): Invoice | undefined {
  const invoices = useDb().invoices
  return React.useMemo(() => invoices.find((i) => i._id === id), [invoices, id])
}

export const invoiceApi = {
  create(data: Omit<Invoice, "_id" | "createdAt" | "updatedAt">): string {
    const id = newId()
    update((db) => ({
      ...db,
      invoices: [
        ...db.invoices,
        { ...data, _id: id, createdAt: now(), updatedAt: now() },
      ],
    }))
    return id
  },
  patch(id: string, data: Partial<Invoice>) {
    update((db) => ({
      ...db,
      invoices: db.invoices.map((i) =>
        i._id === id ? { ...i, ...data, updatedAt: now() } : i
      ),
    }))
  },
  remove(id: string) {
    update((db) => ({
      ...db,
      invoices: db.invoices.filter((i) => i._id !== id),
    }))
  },
  /** Import více faktur najednou (např. ze starého systému). */
  importMany(invoices: Invoice[]) {
    update((db) => ({ ...db, invoices: [...db.invoices, ...invoices] }))
  },
}

// --- Profil firmy ----------------------------------------------------------

export function useProfile(): CompanyProfile {
  return useDb().profile
}

export const profileApi = {
  save(profile: CompanyProfile) {
    update((db) => ({ ...db, profile }))
  },
}
