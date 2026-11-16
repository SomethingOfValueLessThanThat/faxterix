// PDF faktury přes @react-pdf/renderer.
// Vizuál: švýcarská typografie — černá grotesk (Inter Display) na bílém listu,
// přísná dvanáctisloupcová mřížka, žádné linky ani rámečky. Strukturu nese jen
// zarovnání do sloupců, velikost písma a rytmus mezer.

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
import { formatCZK, formatDateLong, formatNumber } from "../format"
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
  paper: "#ffffff",
  ink: "#000000",
  muted: "#6e6e6e",
}

// ── Mřížka ─────────────────────────────────────────────────
// A4 = 595 × 842 pt, 12 sloupců s pevnou mezerou. Každý blok začíná na hraně
// sloupce a má šířku celého počtu sloupců.
const MARGIN = 34
const CONTENT_W = 595 - 2 * MARGIN
const COLS = 12
const GUTTER = 12
const COL_W = (CONTENT_W - (COLS - 1) * GUTTER) / COLS

/** Šířka bloku přes `n` sloupců (včetně mezer mezi nimi). */
const span = (n: number) => n * COL_W + (n - 1) * GUTTER

// Vertikální rytmus: všechny mezery jsou násobky základní jednotky.
const UNIT = 6

// Šířky znaků ASCII 32–126 v Inter Display Bold (setiny em) — react-pdf
// neumí text změřit předem, a nadpis má přesně vyplnit šířku řádku.
const BOLD_W = [
  21, 25, 47, 63, 65, 94, 65, 27, 33, 33, 54, 65, 24, 44, 24, 36, 65, 39, 60,
  62, 66, 60, 62, 55, 61, 62, 24, 25, 65, 65, 65, 57, 101, 71, 64, 73, 70, 61,
  58, 74, 72, 26, 56, 69, 56, 89, 73, 75, 63, 75, 65, 65, 64, 70, 71, 100, 70,
  69, 63, 33, 36, 33, 46, 48, 29, 55, 60, 56, 60, 56, 37, 60, 59, 25, 25, 55,
  25, 88, 59, 58, 60, 60, 37, 52, 37, 59, 55, 82, 54, 55, 52, 44, 35, 44, 65,
]
const HEADING_TRACKING = -0.04
// Krátké jméno by jinak přerostlo do obřího písma.
const HEADING_MAX = 124

function glyphWidth(ch: string): number {
  // Diakritika má šířku základního písmene („č" = „c").
  const code = ch.normalize("NFD").charCodeAt(0) - 32
  return code >= 0 && code < BOLD_W.length ? BOLD_W[code] / 100 : 0.6
}

/** Velikost písma, při které nadpis vyplní celou šířku obsahu. */
function headingSize(text: string): number {
  const em = [...text].reduce(
    (sum, ch) => sum + glyphWidth(ch) + HEADING_TRACKING,
    0
  )
  return Math.min(HEADING_MAX, (CONTENT_W * 0.97) / em)
}

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: 9.5,
    color: c.ink,
    backgroundColor: c.paper,
    paddingTop: MARGIN - UNIT,
    paddingBottom: MARGIN,
    paddingHorizontal: MARGIN,
    lineHeight: 1.4,
  },

  row: { flexDirection: "row", columnGap: GUTTER },
  section: { marginTop: 6 * UNIT },

  heading: { fontWeight: 700, lineHeight: 1, marginTop: -4 },
  label: { fontSize: 7.5, color: c.muted, marginBottom: UNIT / 2 },
  strong: { fontWeight: 600 },
  muted: { color: c.muted },
  right: { textAlign: "right" },

  // ── Hlavička dokladu ───────────────────────────────────────
  docTitle: {
    fontSize: 34,
    fontWeight: 700,
    letterSpacing: -1.2,
    lineHeight: 1,
  },
  docNumber: {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: -0.3,
    marginTop: UNIT,
  },
  partyName: { fontWeight: 600, fontSize: 10.5, marginBottom: 1 },
  factValue: { fontWeight: 600, fontSize: 10.5 },

  // ── Položky ────────────────────────────────────────────────
  itemRow: { paddingVertical: UNIT * 0.75 },
  sub: { color: c.muted, fontSize: 8.5 },

  // ── Souhrn ─────────────────────────────────────────────────
  sumRow: { flexDirection: "row", justifyContent: "space-between" },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 2 * UNIT,
  },
  dueLabel: {
    fontWeight: 600,
    fontSize: 10.5,
    lineHeight: 1,
    paddingBottom: 2,
  },
  dueAmount: {
    fontWeight: 700,
    fontSize: 24,
    letterSpacing: -0.7,
    lineHeight: 1,
  },

  spacer: { flexGrow: 1, minHeight: 6 * UNIT },

  // ── Platba ─────────────────────────────────────────────────
  payTitle: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: -0.9,
    lineHeight: 1,
  },
  qr: { width: 80, height: 80, marginTop: 2 },
  qrCaption: { fontSize: 7.5, color: c.muted, marginTop: UNIT },

  // ── Patička ────────────────────────────────────────────────
  footer: { fontSize: 7.5, lineHeight: 1.45, marginTop: 5 * UNIT },
})

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
  const vatPayer = profile.vatPayer
  const totals = computeTotals(invoice.items, vatPayer)
  const client = invoice.client
  const iban = czechAccountToIban(profile.bankAccount)
  const heading = profile.name || "—"
  const headingPt = headingSize(heading)

  // Rozložení tabulky ve sloupcích mřížky; neplátce sloupec DPH nemá.
  const cols = vatPayer
    ? { desc: 5, qty: 1, price: 2, vat: 2, total: 2 }
    : { desc: 6, qty: 2, price: 2, vat: 0, total: 2 }

  const supplierLines = [
    profile.address.street,
    cityLine(profile.address.zip, profile.address.city),
    profile.ico && `IČO ${profile.ico}`,
    profile.dic && `DIČ ${profile.dic}`,
    vatPayer ? null : "Neplátce DPH",
  ]
  const clientLines = client
    ? [
        client.address.street,
        cityLine(client.address.zip, client.address.city),
        client.ico && `IČO ${client.ico}`,
        client.dic && `DIČ ${client.dic}`,
      ]
    : []

  const paymentMethod = invoice.paymentMethod || "Bankovní převod"
  const facts: [string, string][] = vatPayer
    ? [
        ["Datum vystavení", formatDateLong(invoice.issueDate)],
        ["Datum zdan. plnění", formatDateLong(invoice.taxDate)],
        ["Datum splatnosti", formatDateLong(invoice.dueDate)],
        ["Variabilní symbol", invoice.variableSymbol],
      ]
    : [
        ["Datum vystavení", formatDateLong(invoice.issueDate)],
        ["Datum splatnosti", formatDateLong(invoice.dueDate)],
        ["Způsob platby", paymentMethod],
        ["Variabilní symbol", invoice.variableSymbol],
      ]

  const payRows = (
    [
      ["Způsob platby", paymentMethod],
      ["Číslo účtu", profile.bankAccount],
      ["IBAN", iban ? groupIban(iban) : ""],
      ["Variabilní symbol", invoice.variableSymbol],
      ["Splatnost", formatDateLong(invoice.dueDate)],
      ["Částka", formatCZK(totals.total)],
    ] as [string, string][]
  ).filter(([, value]) => Boolean(value))

  return (
    <Document title={`Faktura ${invoice.number}`}>
      <Page size="A4" style={s.page}>
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

        <View style={[s.row, { marginTop: headingPt * 0.22 + 4 * UNIT }]}>
          <View style={{ width: span(6) }}>
            <Text style={s.docTitle}>Faktura</Text>
            <Text style={s.docNumber}>č. {invoice.number}</Text>
            {vatPayer ? (
              <Text style={[s.muted, { marginTop: UNIT / 3 }]}>
                Daňový doklad
              </Text>
            ) : null}
          </View>
          <Party label="Dodavatel" name={profile.name} lines={supplierLines} />
          <Party
            label="Odběratel"
            name={client?.name || "—"}
            lines={clientLines}
          />
        </View>

        <View style={[s.row, s.section]}>
          {facts.map(([label, value]) => (
            <View key={label} style={{ width: span(3) }}>
              <Text style={s.label}>{label}</Text>
              <Text style={s.factValue}>{value || "—"}</Text>
            </View>
          ))}
        </View>

        <View style={[s.row, s.section, s.label]} fixed>
          <Text style={{ width: span(cols.desc) }}>Položka</Text>
          <Text style={[s.right, { width: span(cols.qty) }]}>Počet</Text>
          <Text style={[s.right, { width: span(cols.price) }]}>
            Cena za jednotku
          </Text>
          {vatPayer ? (
            <Text style={[s.right, { width: span(cols.vat) }]}>DPH</Text>
          ) : null}
          <Text style={[s.right, { width: span(cols.total) }]}>Celkem</Text>
        </View>

        {invoice.items.map((item) => {
          const [title, ...subs] = (item.description || "—").split("\n")
          const vat = round2((lineTotal(item) * item.vatRate) / 100)
          return (
            <View key={item.id} style={[s.row, s.itemRow]} wrap={false}>
              <View style={{ width: span(cols.desc) }}>
                <Text style={s.strong}>{title}</Text>
                {subs.map((sub, i) => (
                  <Text key={i} style={s.sub}>
                    {sub}
                  </Text>
                ))}
              </View>
              <Text style={[s.right, { width: span(cols.qty) }]}>
                {formatQty(item.quantity)} {item.unit}
              </Text>
              <Text style={[s.right, { width: span(cols.price) }]}>
                {formatNumber(item.unitPrice)}
              </Text>
              {vatPayer ? (
                <Text style={[s.right, { width: span(cols.vat) }]}>
                  {formatNumber(vat)}
                </Text>
              ) : null}
              <Text style={[s.right, s.strong, { width: span(cols.total) }]}>
                {formatNumber(lineTotal(item))}
              </Text>
            </View>
          )
        })}

        <View style={[s.row, s.section]} wrap={false}>
          <View style={{ width: span(6) }}>
            {invoice.note ? (
              <>
                <Text style={s.label}>Poznámka</Text>
                <Text>{invoice.note}</Text>
              </>
            ) : null}
          </View>
          <View style={{ width: span(6) }}>
            <SumRow
              label={vatPayer ? "Základ daně" : "Mezisoučet"}
              value={totals.subtotal}
            />
            {vatPayer
              ? totals.vatRows.map((row) => (
                  <SumRow
                    key={row.rate}
                    label={`DPH ${row.rate} %`}
                    value={row.vat}
                  />
                ))
              : null}
            <View style={s.dueRow}>
              <Text style={s.dueLabel}>K úhradě</Text>
              <Text style={s.dueAmount}>{formatCZK(totals.total)}</Text>
            </View>
          </View>
        </View>

        <View style={s.spacer} />

        <View wrap={false}>
          <View style={s.row}>
            <View style={{ width: span(3) }}>
              <Text style={s.payTitle}>Platba</Text>
            </View>
            <View style={{ width: span(3) }}>
              {qrDataUrl ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image style={s.qr} src={qrDataUrl} />
                  <Text style={s.qrCaption}>Zaplaťte QR kódem</Text>
                </>
              ) : null}
            </View>
            <View style={{ width: span(6) }}>
              {payRows.map(([label, value]) => (
                <View key={label} style={s.row}>
                  <Text style={[s.muted, { width: span(2) }]}>{label}</Text>
                  <Text style={[s.strong, { width: span(4) }]}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[s.row, s.footer]}>
            <View style={{ width: span(6) }}>
              <Text>
                {profile.name}
                {vatPayer ? "" : ", neplátce DPH"}
              </Text>
              <Text style={s.muted}>
                Fyzická osoba zapsaná v živnostenském rejstříku.
              </Text>
            </View>
            <View style={{ width: span(3) }}>
              <Text style={s.muted}>E-mail</Text>
              <Text>{profile.email || "—"}</Text>
            </View>
            <View style={{ width: span(3) }}>
              <Text style={s.muted}>Telefon</Text>
              <Text>{profile.phone || "—"}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

function Party({
  label,
  name,
  lines,
}: {
  label: string
  name: string
  lines: (string | null | false | undefined)[]
}) {
  return (
    <View style={{ width: span(3) }}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.partyName}>{name || "—"}</Text>
      {lines.filter(Boolean).map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </View>
  )
}

function SumRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.sumRow}>
      <Text style={s.muted}>{label}</Text>
      <Text>{formatCZK(value)}</Text>
    </View>
  )
}

function cityLine(zip: string, city: string): string {
  return [zip, city].filter(Boolean).join(" ")
}

/** IBAN po čtveřicích, jak se píše na dokladech. */
function groupIban(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, "$1 ")
}

/** Množství bez zbytečných desetinných nul („1", „1,5"). */
function formatQty(n: number): string {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(n)
}
