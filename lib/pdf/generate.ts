"use client"

import type { Invoice, CompanyProfile } from "../types"
import { computeTotals } from "../invoice"
import { buildSpayd } from "../spayd"

/** Vytvoří data URL QR Platby, nebo null pokud chybí IBAN. */
async function buildQrDataUrl(
  invoice: Invoice,
  profile: CompanyProfile
): Promise<string | null> {
  if (!profile.iban) return null
  const total = computeTotals(invoice.items, profile.vatPayer).total
  const payload = buildSpayd({
    iban: profile.iban,
    amount: total,
    variableSymbol: invoice.variableSymbol,
    recipientName: profile.name,
    message: `Faktura ${invoice.number}`,
    dueDate: invoice.dueDate,
  })
  const QRCode = (await import("qrcode")).default
  return QRCode.toDataURL(payload, { margin: 1, width: 320 })
}

async function buildBlob(
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

function fileName(invoice: Invoice): string {
  return `faktura-${invoice.number.replace(/[^\w-]/g, "")}.pdf`
}

/** Stáhne PDF faktury. */
export async function downloadInvoicePdf(
  invoice: Invoice,
  profile: CompanyProfile
) {
  const blob = await buildBlob(invoice, profile)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName(invoice)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Otevře náhled PDF v nové záložce. */
export async function openInvoicePdf(
  invoice: Invoice,
  profile: CompanyProfile
) {
  const blob = await buildBlob(invoice, profile)
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank")
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
