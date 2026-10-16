"use client"

import type { Invoice, CompanyProfile } from "../types"
import { computeTotals } from "../invoice"
import { buildSpayd, czechAccountToIban } from "../spayd"

/** Vytvoří data URL QR Platby, nebo null pokud chybí číslo účtu. */
async function buildQrDataUrl(
  invoice: Invoice,
  profile: CompanyProfile
): Promise<string | null> {
  const iban = czechAccountToIban(profile.bankAccount)
  if (!iban) return null
  const total = computeTotals(invoice.items, profile.vatPayer).total
  const payload = buildSpayd({
    iban,
    amount: total,
    variableSymbol: invoice.variableSymbol,
    recipientName: profile.name,
    message: `Faktura ${invoice.number}`,
    dueDate: invoice.dueDate,
  })
  const QRCode = (await import("qrcode")).default
  return QRCode.toDataURL(payload, { margin: 1, width: 320 })
}

/** Vyrenderuje PDF faktury do blobu. */
export async function renderInvoicePdf(
  invoice: Invoice,
  profile: CompanyProfile
): Promise<Blob> {
  const [{ pdf }, { InvoiceDocument, registerPdfFonts }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./invoice-document"),
  ])
  registerPdfFonts()
  const qrDataUrl = await buildQrDataUrl(invoice, profile)
  return pdf(InvoiceDocument({ invoice, profile, qrDataUrl })).toBlob()
}

export function invoicePdfFileName(invoice: Invoice): string {
  return `faktura-${invoice.number.replace(/[^\w-]/g, "")}.pdf`
}

/** Uloží blob jako soubor přes dočasný odkaz. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Stáhne PDF faktury. */
export async function downloadInvoicePdf(
  invoice: Invoice,
  profile: CompanyProfile
) {
  saveBlob(
    await renderInvoicePdf(invoice, profile),
    invoicePdfFileName(invoice)
  )
}
