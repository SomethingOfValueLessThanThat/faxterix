// Import faktur a klientů z CSV exportu Fakturoidu (formát "Invoices export").
// Parsuje CSV, deduplikuje klienty (podle IČO, jinak podle názvu) a faktury
// (podle čísla) vůči stávajícím datům ve store a sestaví doménové objekty.

import type {
  Client,
  Invoice,
  InvoiceItem,
  ClientSnapshot,
  Address,
  InvoiceStatus,
} from "./types"

export interface ImportResult {
  /** Noví klienti, kteří ve store ještě nejsou. */
  clients: Client[]
  /** Nové faktury (s namapovaným `clientId`). */
  invoices: Invoice[]
  /** Počet přeskočených řádků (duplicitní číslo / chybějící data). */
  skipped: number
}

/** Minimální parser CSV (RFC 4180) – uvozovky, zdvojené `""`, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (ch !== "\r") {
      field += ch
    }
  }
  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Převede částku z českého formátu ("52000,0", "1 234,50") na číslo. */
function parseAmount(raw: string): number {
  let s = raw.replace(/\s/g, "")
  if (!s) return 0
  if (s.includes(",")) {
    // čárka = desetinný oddělovač; tečky jsou tisícové
    s = s.replace(/\./g, "").replace(",", ".")
  }
  const v = Number(s)
  return Number.isFinite(v) ? v : 0
}

/** Stav z Fakturoidu na náš zúžený model. */
function mapStatus(raw: string): InvoiceStatus {
  switch (raw.trim().toLowerCase()) {
    case "paid":
      return "paid"
    case "sent":
    case "open":
    case "overdue":
      return "sent"
    default:
      return "draft"
  }
}

function mapPayment(raw: string): string {
  return raw.trim().toLowerCase() === "cash" ? "Hotovostí" : "Převodem"
}

function mapCountry(raw: string): string {
  const code = raw.trim().toUpperCase()
  if (code === "CZ") return "Česká republika"
  if (code === "SK") return "Slovensko"
  return raw.trim() || "Česká republika"
}

const clientKey = (ico: string, name: string) =>
  ico ? `ico:${ico}` : `name:${name.trim().toLowerCase()}`

/**
 * Sestaví import z CSV. Klienti i faktury jsou deduplikováni vůči `existing`,
 * takže opakovaný import stejného souboru nic nezdvojí.
 */
export function parseFakturoidCsv(
  text: string,
  existing: { clients: Client[]; invoices: Invoice[] }
): ImportResult {
  const rows = parseCsv(text)
  if (rows.length < 2) return { clients: [], invoices: [], skipped: 0 }

  const header = rows[0].map((h) => h.trim())
  const indexOf = (name: string) => header.indexOf(name)
  const col = (r: string[], name: string) => {
    const i = indexOf(name)
    return i >= 0 ? (r[i] ?? "").trim() : ""
  }

  const ts = Date.now()
  const existingNumbers = new Set(existing.invoices.map((i) => i.number))
  const clientIndex = new Map<string, string>() // klíč -> _id
  for (const c of existing.clients) clientIndex.set(clientKey(c.ico, c.name), c._id)

  const clients: Client[] = []
  const invoices: Invoice[] = []
  let skipped = 0

  for (const r of rows.slice(1)) {
    if (r.length === 1 && r[0].trim() === "") continue // prázdný řádek

    const number = col(r, "Number")
    const name = col(r, "Client name")
    if (!number || !name) {
      skipped++
      continue
    }
    if (existingNumbers.has(number)) {
      skipped++
      continue
    }
    existingNumbers.add(number)

    const ico = col(r, "Client registration no").replace(/\s/g, "")
    const dic = col(r, "Client vat no")
    const email = col(r, "Client email")
    const address: Address = {
      street: [col(r, "Client street"), col(r, "Client street2")]
        .filter(Boolean)
        .join(" "),
      city: col(r, "Client city"),
      zip: col(r, "Client zip"),
      country: mapCountry(col(r, "Client country")),
    }

    const key = clientKey(ico, name)
    let clientId = clientIndex.get(key)
    if (!clientId) {
      clientId = crypto.randomUUID()
      clientIndex.set(key, clientId)
      clients.push({
        _id: clientId,
        name,
        ico,
        dic,
        email,
        address,
        createdAt: ts,
        updatedAt: ts,
      })
    }

    const snapshot: ClientSnapshot = { name, ico, dic, email, address }

    const subtotal = parseAmount(col(r, "Subtotal"))
    const vat = parseAmount(col(r, "Vat"))
    const vatRate =
      subtotal > 0 && vat > 0 ? Math.round((vat / subtotal) * 100) : 0

    const item: InvoiceItem = {
      id: crypto.randomUUID(),
      // CSV nenese popisy položek (sloupec "Subject" je jen číselné ID kontaktu),
      // proto z celkové částky sestavíme jednu souhrnnou položku.
      description: `Faktura ${number}`,
      quantity: 1,
      unit: "ks",
      unitPrice: subtotal,
      vatRate,
    }

    invoices.push({
      _id: crypto.randomUUID(),
      number,
      clientId,
      client: snapshot,
      issueDate: col(r, "Issued on"),
      dueDate: col(r, "Due on"),
      taxDate: col(r, "Taxable fulfillment due"),
      items: [item],
      status: mapStatus(col(r, "Status")),
      note: "",
      variableSymbol: col(r, "Variable symbol"),
      paymentMethod: mapPayment(col(r, "Payment method")),
      createdAt: ts,
      updatedAt: ts,
    })
  }

  return { clients, invoices, skipped }
}
