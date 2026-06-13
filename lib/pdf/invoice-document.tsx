// PDF faktury přes @react-pdf/renderer.
// Vizuál: International Typographic Style (Swiss design) v monospace —
// striktní grid, vlasové linky, výrazná typografická hierarchie, jeden akcent.

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
import { computeTotals, lineTotal } from "../invoice"
import { formatCZK, formatDate, formatNumber } from "../format"

let registered = false
export function registerPdfFonts() {
  if (registered) return
  Font.register({
    family: "JetBrains Mono",
    fonts: [
      { src: "/fonts/JetBrainsMono-Regular.ttf", fontWeight: 400 },
      { src: "/fonts/JetBrainsMono-Medium.ttf", fontWeight: 500 },
      { src: "/fonts/JetBrainsMono-Bold.ttf", fontWeight: 700 },
      { src: "/fonts/JetBrainsMono-ExtraBold.ttf", fontWeight: 800 },
    ],
  })
  // Bez dělení slov — mono řádky necháme vcelku.
  Font.registerHyphenationCallback((word) => [word])
  registered = true
}

const c = {
  ink: "#111111",
  paper: "#ffffff",
  muted: "#73726e",
  hair: "#e3e2dd",
  accent: "#e5392e", // swiss red
  paperTint: "#faf9f6",
}

// 8pt modulární grid.
const U = 8

const s = StyleSheet.create({
  page: {
    fontFamily: "JetBrains Mono",
    fontSize: 8,
    color: c.ink,
    backgroundColor: c.paper,
    paddingTop: 7 * U,
    paddingBottom: 7 * U,
    paddingHorizontal: 6 * U,
    lineHeight: 1.5,
  },

  // Signální akcentový pruh u horní hrany.
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: c.accent,
  },

  // ── Masthead ───────────────────────────────────────────────
  masthead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  kicker: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  kickerSquare: {
    width: 7,
    height: 7,
    backgroundColor: c.accent,
    marginRight: 6,
  },
  kickerText: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  number: {
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: -0.8,
    lineHeight: 1,
  },
  mastRight: { alignItems: "flex-end", maxWidth: 220 },
  supplierName: { fontSize: 10, fontWeight: 700, textAlign: "right" },
  mutedRight: { fontSize: 7.5, color: c.muted, textAlign: "right" },

  ruleThick: {
    height: 2,
    backgroundColor: c.ink,
    marginTop: 2 * U,
    marginBottom: 0,
  },

  // ── Sekční štítky ──────────────────────────────────────────
  label: {
    fontSize: 6.5,
    color: c.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  // ── Strany ─────────────────────────────────────────────────
  parties: { flexDirection: "row", marginTop: 2 * U },
  partyCol: { flex: 1, paddingRight: 3 * U },
  partyColRight: {
    flex: 1,
    paddingLeft: 3 * U,
    borderLeftWidth: 1,
    borderLeftColor: c.hair,
  },
  partyName: { fontSize: 10.5, fontWeight: 700, marginBottom: 3 },
  addrLine: { fontSize: 8.5 },
  idLine: { fontSize: 8.5, color: c.muted },

  // ── Meta pás (data + VS) ───────────────────────────────────
  metaBand: {
    flexDirection: "row",
    marginTop: 2.5 * U,
    borderTopWidth: 1,
    borderTopColor: c.ink,
    borderBottomWidth: 1,
    borderBottomColor: c.hair,
  },
  metaCell: { flex: 1, paddingVertical: U, paddingHorizontal: 1.5 * U },
  metaCellDivided: { borderLeftWidth: 1, borderLeftColor: c.hair },
  metaValue: { fontSize: 9.5, fontWeight: 700, letterSpacing: -0.2 },

  // ── Tabulka položek ────────────────────────────────────────
  thead: {
    flexDirection: "row",
    marginTop: 3 * U,
    paddingBottom: 5,
    borderBottomWidth: 1.5,
    borderBottomColor: c.ink,
  },
  theadText: {
    fontSize: 6.5,
    color: c.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tr: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.hair,
  },
  cIdx: { width: 20, color: c.muted, fontSize: 7.5 },
  cDesc: { flex: 1, paddingRight: U },
  cDescText: { fontSize: 8.5 },
  cQty: { width: 70, textAlign: "right" },
  cPrice: { width: 78, textAlign: "right" },
  cVat: { width: 38, textAlign: "right", color: c.muted },
  cTotal: { width: 86, textAlign: "right", fontWeight: 700 },

  // ── Souhrn ─────────────────────────────────────────────────
  summaryWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 2 * U,
  },
  summaryBox: { width: 268 },
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
  },
  sumLabel: { fontSize: 8, color: c.muted },
  sumValue: { fontSize: 8 },
  grandBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: c.accent,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  grandLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: c.paper,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  grandValue: {
    fontSize: 15,
    fontWeight: 800,
    color: c.paper,
    letterSpacing: -0.5,
  },

  // ── Platba + QR ────────────────────────────────────────────
  payRow: {
    flexDirection: "row",
    marginTop: 3.5 * U,
    paddingTop: 2 * U,
    borderTopWidth: 1,
    borderTopColor: c.hair,
    gap: 3 * U,
    alignItems: "flex-start",
  },
  payInfo: { flex: 1 },
  payLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: c.hair,
    maxWidth: 280,
  },
  payKey: { fontSize: 8, color: c.muted },
  payVal: { fontSize: 8.5, fontWeight: 500 },
  qrBox: { alignItems: "center" },
  qrFrame: {
    borderWidth: 1,
    borderColor: c.ink,
    padding: 5,
  },
  qr: { width: 92, height: 92 },
  qrCaption: {
    fontSize: 6.5,
    color: c.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 5,
  },

  note: {
    marginTop: 2.5 * U,
    fontSize: 8,
    color: c.muted,
    lineHeight: 1.6,
  },

  // ── Patička ────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 3.5 * U,
    left: 6 * U,
    right: 6 * U,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: c.hair,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 6.5,
    color: c.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
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
      {street ? <Text style={s.addrLine}>{street}</Text> : null}
      {(zip || city) && (
        <Text style={s.addrLine}>{[zip, city].filter(Boolean).join(" ")}</Text>
      )}
      {ico ? <Text style={s.idLine}>IČO {ico}</Text> : null}
      {dic ? <Text style={s.idLine}>DIČ {dic}</Text> : null}
      {email ? <Text style={s.idLine}>{email}</Text> : null}
    </View>
  )
}

function PayLine({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.payLine}>
      <Text style={s.payKey}>{k}</Text>
      <Text style={s.payVal}>{v}</Text>
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

  const meta: { label: string; value: string }[] = [
    { label: "Datum vystavení", value: formatDate(invoice.issueDate) || "—" },
    { label: "Datum splatnosti", value: formatDate(invoice.dueDate) || "—" },
    ...(profile.vatPayer
      ? [{ label: "DUZP", value: formatDate(invoice.taxDate) || "—" }]
      : []),
    { label: "Var. symbol", value: invoice.variableSymbol || "—" },
  ]

  return (
    <Document title={`Faktura ${invoice.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.topBar} fixed />

        {/* Masthead */}
        <View style={s.masthead}>
          <View>
            <View style={s.kicker}>
              <View style={s.kickerSquare} />
              <Text style={s.kickerText}>Faktura — daňový doklad</Text>
            </View>
            <Text style={s.number}>{invoice.number}</Text>
          </View>
          <View style={s.mastRight}>
            <Text style={s.supplierName}>{profile.name || "—"}</Text>
            <Text style={s.mutedRight}>
              {profile.vatPayer ? "Plátce DPH" : "Neplátce DPH"}
            </Text>
            {profile.ico ? (
              <Text style={s.mutedRight}>IČO {profile.ico}</Text>
            ) : null}
          </View>
        </View>
        <View style={s.ruleThick} />

        {/* Strany */}
        <View style={s.parties}>
          <View style={s.partyCol}>
            <Text style={s.label}>Dodavatel</Text>
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
          <View style={s.partyColRight}>
            <Text style={s.label}>Odběratel</Text>
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

        {/* Meta pás */}
        <View style={s.metaBand}>
          {meta.map((m, i) => (
            <View
              key={m.label}
              style={[s.metaCell, i > 0 ? s.metaCellDivided : {}]}
            >
              <Text style={s.label}>{m.label}</Text>
              <Text style={s.metaValue}>{m.value}</Text>
            </View>
          ))}
        </View>

        {/* Tabulka položek */}
        <View style={s.thead}>
          <Text style={[s.cIdx, s.theadText]}>#</Text>
          <Text style={[s.cDesc, s.theadText]}>Popis</Text>
          <Text style={[s.cQty, s.theadText]}>Množství</Text>
          <Text style={[s.cPrice, s.theadText]}>Cena / MJ</Text>
          {profile.vatPayer && <Text style={[s.cVat, s.theadText]}>DPH</Text>}
          <Text style={[s.cTotal, s.theadText]}>Celkem</Text>
        </View>
        {invoice.items.map((item, i) => (
          <View key={item.id} style={s.tr} wrap={false}>
            <Text style={s.cIdx}>{String(i + 1).padStart(2, "0")}</Text>
            <View style={s.cDesc}>
              <Text style={s.cDescText}>{item.description || "—"}</Text>
            </View>
            <Text style={s.cQty}>
              {formatNumber(item.quantity)} {item.unit}
            </Text>
            <Text style={s.cPrice}>{formatCZK(item.unitPrice)}</Text>
            {profile.vatPayer && <Text style={s.cVat}>{item.vatRate} %</Text>}
            <Text style={s.cTotal}>{formatCZK(lineTotal(item))}</Text>
          </View>
        ))}

        {/* Souhrn */}
        <View style={s.summaryWrap}>
          <View style={s.summaryBox}>
            {profile.vatPayer && (
              <>
                <View style={s.sumRow}>
                  <Text style={s.sumLabel}>Základ bez DPH</Text>
                  <Text style={s.sumValue}>{formatCZK(totals.subtotal)}</Text>
                </View>
                {totals.vatRows.map((row) => (
                  <View key={row.rate} style={s.sumRow}>
                    <Text style={s.sumLabel}>DPH {row.rate} %</Text>
                    <Text style={s.sumValue}>{formatCZK(row.vat)}</Text>
                  </View>
                ))}
              </>
            )}
            <View style={s.grandBar}>
              <Text style={s.grandLabel}>K úhradě</Text>
              <Text style={s.grandValue}>{formatCZK(totals.total)}</Text>
            </View>
          </View>
        </View>

        {/* Platba + QR */}
        <View style={s.payRow} wrap={false}>
          <View style={s.payInfo}>
            <Text style={s.label}>Platební údaje</Text>
            {profile.bankAccount ? (
              <PayLine k="Účet" v={profile.bankAccount} />
            ) : null}
            {profile.iban ? <PayLine k="IBAN" v={profile.iban} /> : null}
            <PayLine k="Variabilní symbol" v={invoice.variableSymbol || "—"} />
            <PayLine k="Částka" v={formatCZK(totals.total)} />
            {invoice.paymentMethod ? (
              <PayLine k="Způsob platby" v={invoice.paymentMethod} />
            ) : null}
          </View>
          {qrDataUrl ? (
            <View style={s.qrBox}>
              <View style={s.qrFrame}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image style={s.qr} src={qrDataUrl} />
              </View>
              <Text style={s.qrCaption}>QR Platba</Text>
            </View>
          ) : null}
        </View>

        {invoice.note ? <Text style={s.note}>{invoice.note}</Text> : null}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Faktura {invoice.number}</Text>
          <Text style={s.footerText}>Vystaveno v aplikaci FAXTERIX</Text>
        </View>
      </Page>
    </Document>
  )
}
