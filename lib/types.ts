// Doménové typy aplikace FAXTERIX.
// Datový model je navržen tak, aby šel 1:1 přenést do Convex schématu.

export type Id = string

/** Adresa firmy/klienta. */
export interface Address {
  street: string
  city: string
  zip: string
  country: string
}

/** Klient v adresáři. */
export interface Client {
  _id: Id
  name: string
  ico: string
  dic: string
  email: string
  address: Address
  createdAt: number
  updatedAt: number
}

/** Položka faktury. */
export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  vatRate: number // procenta, např. 21
}

export type InvoiceStatus = "draft" | "sent" | "paid"

/** Faktura. */
export interface Invoice {
  _id: Id
  number: string
  clientId: Id | null
  /** Snapshot klienta v době vystavení (kvůli historické věrnosti). */
  client: ClientSnapshot | null
  issueDate: string // ISO yyyy-mm-dd
  dueDate: string
  taxDate: string
  items: InvoiceItem[]
  status: InvoiceStatus
  note: string
  variableSymbol: string
  paymentMethod: string
  createdAt: number
  updatedAt: number
}

export interface ClientSnapshot {
  name: string
  ico: string
  dic: string
  email: string
  address: Address
}

/** Profil vystavovatele (moje firma) + platební údaje pro QR. */
export interface CompanyProfile {
  name: string
  ico: string
  dic: string
  vatPayer: boolean
  address: Address
  email: string
  phone: string
  iban: string
  bankAccount: string
  /** Výchozí splatnost ve dnech. */
  dueDays: number
  /** Předčíslí / formát čísla faktury, např. "{YYYY}{NNNN}". */
  numberFormat: string
  /** Vybrané pasmo (1, 2, nebo 3). */
  selectedBand: 1 | 2 | 3
  /** Limity pro jednotlivá pasma [1. pasmo, 2. pasmo, 3. pasmo]. */
  bandLimits: number[]
}

export const emptyAddress = (): Address => ({
  street: "",
  city: "",
  zip: "",
  country: "Česká republika",
})
