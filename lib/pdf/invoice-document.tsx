// PDF faktury přes @react-pdf/renderer.

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"
import type { Invoice, CompanyProfile } from "../types"
import { computeTotals } from "../invoice"
import { formatCZK, formatDate, formatNumber } from "../format"

let registered = false
export function registerPdfFonts() {
  if (registered) return
  Font.register({
    family: "Roboto",
    fonts: [
      { src: "/fonts/Roboto-Regular.ttf", fontWeight: 400 },
      { src: "/fonts/Roboto-Medium.ttf", fontWeight: 500 },
      { src: "/fonts/Roboto-Bold.ttf", fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((word) => [word])
  registered = true
}

const c = {
  text: "#18181b",
  muted: "#71717a",
  line: "#e4e4e7",
  accent: "#2563eb",
  zebra: "#f4f4f5",
}

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9,
    color: c.text,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    lineHeight: 1.4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  h1: { fontSize: 20, fontWeight: 700 },
  invoiceNo: { fontSize: 11, color: c.muted, marginTop: 2 },
  parties: { flexDirection: "row", gap: 24, marginBottom: 20 },
  party: { flex: 1 },
  partyLabel: {
    fontSize: 8,
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  partyName: { fontWeight: 700, fontSize: 11, marginBottom: 2 },
  meta: { flexDirection: "row", gap: 24, marginBottom: 20 },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 8, color: c.muted, marginBottom: 1 },
  metaValue: { fontWeight: 500 },
  thead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: c.text,
    paddingBottom: 4,
    fontSize: 8,
    color: c.muted,
    textTransform: "uppercase",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  cDesc: { flex: 4 },
  cQty: { flex: 1.4, textAlign: "right" },
  cPrice: { flex: 1.6, textAlign: "right" },
  cVat: { flex: 1, textAlign: "right" },
  cTotal: { flex: 1.8, textAlign: "right" },
  summary: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  summaryBox: { width: 240 },
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: c.text,
  },
  totalLabel: { fontSize: 12, fontWeight: 700 },
  totalValue: { fontSize: 12, fontWeight: 700, color: c.accent },
  payRow: {
    flexDirection: "row",
    marginTop: 28,
    gap: 20,
    alignItems: "flex-start",
  },
  payInfo: { flex: 1 },
  qrBox: { alignItems: "center" },
  qr: { width: 96, height: 96 },
  qrCaption: { fontSize: 7, color: c.muted, marginTop: 2 },
  note: { marginTop: 20, color: c.muted },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7,
    color: c.muted,
  },
})

function AddressBlock({
  name,
  ico,
  dic,
  email,
  street,
  city,
  zip,
}: {
  name: string
  ico?: string
  dic?: string
  email?: string
  street?: string
  city?: string
  zip?: string
}) {
  return (
    <View>
      <Text style={s.partyName}>{name || "—"}</Text>
      {street ? <Text>{street}</Text> : null}
      {(zip || city) && <Text>{[zip, city].filter(Boolean).join(" ")}</Text>}
      {ico ? <Text>IČO: {ico}</Text> : null}
      {dic ? <Text>DIČ: {dic}</Text> : null}
      {email ? <Text>{email}</Text> : null}
    </View>
  )
}

export interface InvoicePdfProps {
  invoice: Invoice
  profile: CompanyProfile
  qrDataUrl: string | null
}

export function InvoiceDocument({
  invoice,
  profile,
  qrDataUrl,
}: InvoicePdfProps) {
  const totals = computeTotals(invoice.items, profile.vatPayer)
  const client = invoice.client

  return (
    <Document title={`Faktura ${invoice.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.h1}>Faktura</Text>
            <Text style={s.invoiceNo}>č. {invoice.number}</Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={{ fontWeight: 700 }}>{profile.name || "—"}</Text>
            {profile.vatPayer ? (
              <Text style={{ color: c.muted }}>Plátce DPH</Text>
            ) : (
              <Text style={{ color: c.muted }}>Neplátce DPH</Text>
            )}
          </View>
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.partyLabel}>Dodavatel</Text>
            <AddressBlock
              name={profile.name}
              ico={profile.ico}
              dic={profile.dic}
              email={profile.email}
              street={profile.address.street}
              city={profile.address.city}
              zip={profile.address.zip}
            />
          </View>
          <View style={s.party}>
            <Text style={s.partyLabel}>Odběratel</Text>
            <AddressBlock
              name={client?.name ?? ""}
              ico={client?.ico}
              dic={client?.dic}
              email={client?.email}
              street={client?.address.street}
              city={client?.address.city}
              zip={client?.address.zip}
            />
          </View>
        </View>

        <View style={s.meta}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Datum vystavení</Text>
            <Text style={s.metaValue}>{formatDate(invoice.issueDate)}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Datum splatnosti</Text>
            <Text style={s.metaValue}>{formatDate(invoice.dueDate)}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>DUZP</Text>
            <Text style={s.metaValue}>{formatDate(invoice.taxDate)}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Var. symbol</Text>
            <Text style={s.metaValue}>{invoice.variableSymbol || "—"}</Text>
          </View>
        </View>

        <View style={s.thead}>
          <Text style={s.cDesc}>Popis</Text>
          <Text style={s.cQty}>Množství</Text>
          <Text style={s.cPrice}>Cena/MJ</Text>
          {profile.vatPayer && <Text style={s.cVat}>DPH</Text>}
          <Text style={s.cTotal}>Celkem</Text>
        </View>
        {invoice.items.map((item) => (
          <View key={item.id} style={s.tr}>
            <Text style={s.cDesc}>{item.description || "—"}</Text>
            <Text style={s.cQty}>
              {formatNumber(item.quantity)} {item.unit}
            </Text>
            <Text style={s.cPrice}>{formatCZK(item.unitPrice)}</Text>
            {profile.vatPayer && <Text style={s.cVat}>{item.vatRate}%</Text>}
            <Text style={s.cTotal}>
              {formatCZK(item.quantity * item.unitPrice)}
            </Text>
          </View>
        ))}

        <View style={s.summary}>
          <View style={s.summaryBox}>
            {profile.vatPayer && (
              <>
                <View style={s.sumRow}>
                  <Text>Základ</Text>
                  <Text>{formatCZK(totals.subtotal)}</Text>
                </View>
                {totals.vatRows.map((row) => (
                  <View key={row.rate} style={s.sumRow}>
                    <Text style={{ color: c.muted }}>DPH {row.rate}%</Text>
                    <Text style={{ color: c.muted }}>{formatCZK(row.vat)}</Text>
                  </View>
                ))}
              </>
            )}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>K úhradě</Text>
              <Text style={s.totalValue}>{formatCZK(totals.total)}</Text>
            </View>
          </View>
        </View>

        <View style={s.payRow}>
          <View style={s.payInfo}>
            <Text style={s.partyLabel}>Platební údaje</Text>
            {profile.bankAccount ? (
              <Text>Účet: {profile.bankAccount}</Text>
            ) : null}
            {profile.iban ? <Text>IBAN: {profile.iban}</Text> : null}
            <Text>Variabilní symbol: {invoice.variableSymbol || "—"}</Text>
            <Text>Částka: {formatCZK(totals.total)}</Text>
            {invoice.paymentMethod ? (
              <Text>Způsob platby: {invoice.paymentMethod}</Text>
            ) : null}
          </View>
          {qrDataUrl ? (
            <View style={s.qrBox}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image style={s.qr} src={qrDataUrl} />
              <Text style={s.qrCaption}>QR Platba</Text>
            </View>
          ) : null}
        </View>

        {invoice.note ? <Text style={s.note}>{invoice.note}</Text> : null}

        <Text style={s.footer} fixed>
          Vystaveno v aplikaci FAXTERIX
        </Text>
      </Page>
    </Document>
  )
}
