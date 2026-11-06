// PDF faktury přes @react-pdf/renderer.
// Vizuál: černý list, bílá grotesk (Inter Display), obří název dodavatele
// v hranatých závorkách přes celou šířku, minimum linek, platební blok s QR
// a patička se čtyřmi sloupci údajů dodavatele.

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
import { computeTotals, lineTotal, round2 } from "../invoice"
import { formatCZK, formatDate, formatDateLong, formatNumber } from "../format"
import { czechAccountToIban } from "../spayd"

const FONT = "Inter Display"

let registered = false
export function registerPdfFonts() {
  if (registered) return
  Font.register({
    family: FONT,
    fonts: [
      { src: "/fonts/InterDisplay-Medium.ttf", fontWeight: 500 },
      { src: "/fonts/InterDisplay-SemiBold.ttf", fontWeight: 600 },
      { src: "/fonts/InterDisplay-Bold.ttf", fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((word) => [word])
  registered = true
}

const c = {
  paper: "#000000",
  ink: "#f2f2f2",
}

// A4 = 595 × 842 pt; okraj 21 pt ze všech stran jako na předloze.
const MARGIN = 21
const CONTENT_W = 595 - 2 * MARGIN
// Levé hrany sloupců (od levého okraje obsahu) převzaté z předlohy.
const COL_2 = 140
const COL_RIGHT = 279

// Šířky velkých písmen Inter Display Bold (A–Z, v setinách em) — react-pdf
// neumí text změřit předem, a nadpis musí přesně vyplnit šířku řádku.
const UPPER_W = [
  71, 64, 73, 70, 61, 58, 74, 72, 26, 56, 69, 56, 89, 73, 75, 63, 75, 65, 65,
  64, 70, 71, 100, 70, 69, 63,
]
const HEADING_TRACKING = -0.035
// Krátké jméno by jinak přerostlo vyhrazenou výšku hlavičky.
const HEADING_MAX = 100

function glyphWidth(ch: string): number {
  const base = ch.normalize("NFD")[0]
  const code = base.charCodeAt(0) - 65
  if (code >= 0 && code < 26) return UPPER_W[code] / 100
  if (/\d/.test(base)) return 0.65
  if (base === " ") return 0.21
  if (base === "[" || base === "]") return 0.33
  if (base === "." || base === ",") return 0.24
  if (base === "-") return 0.44
  return 0.7
}

/** Velikost písma, při které nadpis vyplní celou šířku obsahu. */
function headingSize(text: string): number {
  const chars = [...text]
  const em = chars.reduce(
    (sum, ch) => sum + glyphWidth(ch) + HEADING_TRACKING,
    0
  )
  return Math.min(HEADING_MAX, (CONTENT_W * 0.97) / em)
}

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 9.5,
    color: c.ink,
    backgroundColor: c.paper,
    paddingTop: 22,
    paddingBottom: MARGIN,
    paddingHorizontal: MARGIN,
    lineHeight: 1.05,
  },

  // Pevná výška, aby meta řádek seděl na stejném místě pro jakkoli dlouhé jméno.
  header: { height: 123 },
  heading: { fontWeight: 700, lineHeight: 1 },

  // ── Meta řádek (datum, klient, číslo, předmět, FAKTURA) ────
  meta: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  metaCol1: {
    width: COL_2,
    fontSize: 13,
    letterSpacing: -0.4,
    lineHeight: 1.1,
  },
  metaCol2: { flex: 1, fontSize: 13, letterSpacing: -0.4, lineHeight: 1.1 },
  docTitle: {
    fontSize: 37,
    fontWeight: 700,
    letterSpacing: -1.4,
    lineHeight: 0.8,
  },
  rule: { height: 0.75, backgroundColor: c.ink },
  metaRule: { marginTop: 13 },

  // ── Položky ────────────────────────────────────────────────
  items: { marginTop: 9, minHeight: 222 },
  row: { flexDirection: "row", letterSpacing: -0.2, marginBottom: 10 },
  cDesc: { width: COL_RIGHT + 10, paddingRight: 12 },
  sub: { paddingLeft: 36 },
  cQty: { width: 71 },
  cPrice: { width: 72 },
  cVat: { width: 50 },
  cTotal: { flex: 1, textAlign: "right" },

  // ── Souhrn ─────────────────────────────────────────────────
  summary: { marginLeft: COL_RIGHT, letterSpacing: -0.2 },
  sumLabel: { textTransform: "uppercase" },
  sumRow: { flexDirection: "row", justifyContent: "space-between" },
  dueRow: { marginTop: 10 },

  spacer: { flexGrow: 1 },

  // ── Platba ─────────────────────────────────────────────────
  payment: {
    flexDirection: "row",
    paddingTop: 9,
    fontSize: 7.5,
    lineHeight: 1.45,
    textTransform: "uppercase",
    letterSpacing: -0.1,
  },
  payCol1: { width: COL_2, justifyContent: "space-between" },
  payCol2: { width: COL_RIGHT - COL_2, justifyContent: "space-between" },
  payCol3: { flex: 1, paddingTop: 3 },
  payTitle: {
    fontSize: 29,
    fontWeight: 700,
    letterSpacing: -1.2,
    lineHeight: 1,
    marginBottom: 17,
  },
  payRef: { paddingTop: 2 },
  gap: { marginTop: 11 },
  qr: { width: 58, height: 58, marginTop: 19, marginBottom: 9 },

  terms: {
    fontSize: 5.6,
    fontWeight: 500,
    lineHeight: 1.3,
    textTransform: "none",
    letterSpacing: 0,
  },
  termsTitle: { fontWeight: 700, textTransform: "uppercase" },
  termsBold: { fontWeight: 700 },

  // ── Patička ────────────────────────────────────────────────
  footer: {
    marginTop: 22,
    paddingTop: 6,
    borderTopWidth: 0.75,
    borderTopColor: c.ink,
    flexDirection: "row",
    fontSize: 5.5,
    fontWeight: 700,
    lineHeight: 1.45,
    textTransform: "uppercase",
  },
  footerCol: { flex: 1, paddingRight: 8 },
})

const br = (text: string) => `[${text}]`

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
  const iban = czechAccountToIban(profile.bankAccount)
  const heading = br((profile.name || "—").toUpperCase())
  const headingPt = headingSize(heading)

  const clientAddress = client
    ? [
        client.address.street,
        [client.address.zip, client.address.city].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ")
    : ""
  const clientIds = client
    ? [
        client.ico && `IČO: ${client.ico}`,
        client.dic && `DIČ: ${client.dic}`,
      ].filter(Boolean)
    : []

  const terms = [
    client
      ? `Odběratel: ${client.name}${clientAddress ? `, ${clientAddress}` : ""}.`
      : null,
    clientIds.length ? `${clientIds.join(", ")}.` : null,
    `Datum vystavení: ${formatDate(invoice.issueDate) || "—"}. Datum splatnosti: ${formatDate(invoice.dueDate) || "—"}.`,
    profile.vatPayer
      ? `Datum uskutečnění zdanitelného plnění: ${formatDate(invoice.taxDate) || "—"}.`
      : null,
    `Při platbě uveďte variabilní symbol ${invoice.variableSymbol || "—"}.`,
    invoice.note || null,
  ].filter((t): t is string => Boolean(t))

  const supplierIds = profile.dic
    ? { label: "IČO / DIČ", value: `${profile.ico} / ${profile.dic}` }
    : { label: "IČO", value: profile.ico }

  return (
    <Document title={`Faktura ${invoice.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text
            style={[
              s.heading,
              {
                fontSize: headingPt,
                letterSpacing: HEADING_TRACKING * headingPt,
              },
            ]}
          >
            {heading}
          </Text>
        </View>

        <View style={s.meta}>
          <View style={s.metaCol1}>
            <Text>{br(formatDateLong(invoice.issueDate) || "—")}</Text>
            <Text>{br(client?.name || "—")}</Text>
          </View>
          <View style={s.metaCol2}>
            <Text>{br(`#${invoice.number}`)}</Text>
            <Text>
              {br(profile.vatPayer ? "Daňový doklad" : "Nejsem plátce DPH")}
            </Text>
          </View>
          <Text style={s.docTitle}>FAKTURA</Text>
        </View>
        <View style={[s.rule, s.metaRule]} />

        <View style={s.items}>
          {invoice.items.map((item) => {
            const [title, ...subs] = (item.description || "—").split("\n")
            const vat = profile.vatPayer
              ? round2((lineTotal(item) * item.vatRate) / 100)
              : 0
            return (
              <View key={item.id} style={s.row} wrap={false}>
                <View style={s.cDesc}>
                  <Text>{title}</Text>
                  {subs.map((sub, i) => (
                    <Text key={i} style={s.sub}>
                      {sub}
                    </Text>
                  ))}
                </View>
                <Text style={s.cQty}>
                  {formatQty(item.quantity)} {item.unit}
                </Text>
                <Text style={s.cPrice}>{formatNumber(item.unitPrice)}</Text>
                <Text style={s.cVat}>{formatNumber(vat)}</Text>
                <Text style={s.cTotal}>{formatNumber(lineTotal(item))}</Text>
              </View>
            )
          })}
        </View>

        <View style={s.summary} wrap={false}>
          <SumRow
            label={profile.vatPayer ? "Základ daně:" : "Mezisoučet:"}
            value={totals.subtotal}
          />
          {profile.vatPayer ? (
            totals.vatRows.map((row) => (
              <SumRow
                key={row.rate}
                label={`DPH (${row.rate} %):`}
                value={row.vat}
              />
            ))
          ) : (
            <SumRow label="DPH (neplátce):" value={0} />
          )}
          <SumRow label="Celkem:" value={totals.total} />
          <View style={s.dueRow}>
            <SumRow label="K úhradě (CZK) :" value={totals.total} />
          </View>
        </View>

        <View style={s.spacer} />

        <View style={s.rule} />
        <View style={s.payment} wrap={false}>
          <View style={s.payCol1}>
            <View>
              <Text style={s.payTitle}>PLATBA</Text>
              <Text>{br(invoice.paymentMethod || "Bankovní převod")}</Text>
              <Text style={s.gap}>{br(profile.name || "—")}</Text>
              {profile.bankAccount ? (
                <Text>Účet: {profile.bankAccount}</Text>
              ) : null}
              {iban ? <Text>IBAN: {iban}</Text> : null}
            </View>
            <Text style={s.gap}>
              {br(`Splatnost: ${formatDate(invoice.dueDate) || "—"}`)}
            </Text>
          </View>

          <View style={s.payCol2}>
            <View>
              <Text style={s.payRef}>
                {br(`Faktura č. ${invoice.number}`)}
                {"\n"}
                {br(`VS: ${invoice.variableSymbol || "—"}`)}
              </Text>
              {qrDataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image style={s.qr} src={qrDataUrl} />
              ) : null}
            </View>
            {qrDataUrl ? <Text>Zaplaťte QR kódem</Text> : null}
          </View>

          <View style={[s.payCol3, s.terms]}>
            <Text style={s.termsTitle}>Fakturační údaje:</Text>
            {terms.map((t, i) => (
              <Text key={i}>
                {i + 1}. {t}
              </Text>
            ))}
            <Text style={s.termsBold}>
              {profile.vatPayer
                ? "Dodavatel je plátcem DPH."
                : "Dodavatel není plátcem DPH."}{" "}
              Fyzická osoba zapsaná v živnostenském rejstříku.
            </Text>
          </View>
        </View>

        <View style={s.footer}>
          <View style={s.footerCol}>
            <Text>{br(profile.name || "—")}</Text>
            <Text>{br(profile.address.street || "—")}</Text>
          </View>
          <View style={s.footerCol}>
            <Text>
              {br(
                [profile.address.zip, profile.address.city]
                  .filter(Boolean)
                  .join(" ") || "—"
              )}
            </Text>
            <Text>{br(profile.address.country || "Česká republika")}</Text>
          </View>
          <View style={s.footerCol}>
            <Text>{br(supplierIds.label)}</Text>
            <Text>{br(supplierIds.value || "—")}</Text>
          </View>
          <View style={s.footerCol}>
            <Text>{br(profile.email || "—")}</Text>
            <Text>{br(profile.phone || "—")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

function SumRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.sumRow}>
      <Text style={s.sumLabel}>{label}</Text>
      <Text>{formatCZK(value)}</Text>
    </View>
  )
}

/** Množství bez zbytečných desetinných nul („1", „1,5"). */
function formatQty(n: number): string {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(n)
}
