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
  /** Datum úhrady (ISO yyyy-mm-dd), jen u zaplacených faktur. */
  paidDate?: string
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

/** Perioda pravidelného výdaje. */
export type ExpensePeriod = "monthly" | "yearly"

/** Pravidelný výdaj (měsíční nebo roční). */
export interface Expense {
  _id: Id
  name: string
  amount: number
  period: ExpensePeriod
  /** Měsíc (yyyy-mm), od kdy se výdaj odškrtává v checklistu plateb. */
  checklistSince?: string
  createdAt: number
  updatedAt: number
}

/** Položka checklistu: id výdaje, nebo paušální daň (ta dokument výdaje nemá). */
export type ChecklistItemId = Id | "flatTax"

/** Odškrtnutá platba položky checklistu v daném měsíci. */
export interface ExpensePayment {
  _id: Id
  item: ChecklistItemId
  month: string // yyyy-mm
  paidAt: number
  /** "bank" = spárováno z bankovní notifikace, jinak odškrtnuto ručně. */
  source?: "bank"
}

/** Passkey (Touch ID) pro přihlášení – bez veřejného klíče, ten zná jen server. */
export interface Passkey {
  _id: Id
  name: string
  createdAt: number
  lastUsedAt?: number
}

/** Podmínky smlouvy vytažené AI (a případně opravené ručně). */
export interface ContractTerms {
  counterparty: string
  counterpartyIco?: string
  summary: string
  startDate?: string // ISO yyyy-mm-dd
  /** Konec doby určité; chybí = smlouva na dobu neurčitou. */
  endDate?: string
  autoRenewal: boolean
  /** O kolik měsíců se smlouva automaticky prodlužuje. */
  renewalMonths?: number
  notice?: { amount: number; unit: "days" | "months" }
  rate?: string
  paymentDays?: number
  confidentialityUntil?: string
  keyPoints: string[]
}

export type ContractExtraction = "pending" | "done" | "failed"

/** Smlouva v trezoru (PDF v Convex storage). */
export interface Contract {
  _id: Id
  title: string
  fileName: string
  fileUrl: string | null
  clientId: Id | null
  extraction: ContractExtraction
  extractionError?: string
  /** Chybí, dokud AI výtah neproběhne. */
  terms?: ContractTerms
  createdAt: number
  updatedAt: number
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
  bankAccount: string
  /** Výchozí splatnost ve dnech. */
  dueDays: number
  /** Předčíslí / formát čísla faktury, např. "{YYYY}{NNNN}". */
  numberFormat: string
  /** Vybrané pasmo (1, 2, nebo 3). */
  selectedBand: 1 | 2 | 3
  /** Limity pro jednotlivá pasma [1. pasmo, 2. pasmo, 3. pasmo]. */
  bandLimits: number[]
  /** Měsíční platba paušální daně v Kč. */
  flatTaxMonthly: number
  /** Měsíc (yyyy-mm), od kdy se paušální daň odškrtává v checklistu plateb. */
  flatTaxChecklistSince?: string
}

export const emptyAddress = (): Address => ({
  street: "",
  city: "",
  zip: "",
  country: "Česká republika",
})
