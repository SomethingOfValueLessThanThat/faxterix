// PDF faktury přes @react-pdf/renderer.
// Vizuál: švýcarská typografie — černá grotesk (Inter Display) na bílém listu,
// přísná dvanáctisloupcová mřížka, žádné linky ani rámečky. Strukturu nese jen
// zarovnání do sloupců, typografická škála a rytmus mezer.
//
// Typografie je záměrně úsporná, aby list působil jednotně:
// - velikosti: nadpis (jméno, roztažené na šířku) · titulek 24 · text 9,5 · popisek 7,5
// - řezy: Medium pro běžný text, Bold pro titulky a hlavní hodnoty
// - popisek je vždy malý šedý nad hodnotou, ve všech blocích stejně

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

// ── Typografická škála ─────────────────────────────────────
const TEXT = 9.5
const SMALL = 7.5
const TITLE = 24
const REGULAR = 500
const BOLD = 700

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
const HEADING_W = [
  21, 25, 47, 63, 65, 94, 65, 27, 33, 33, 54, 65, 24, 44, 24, 36, 65, 39, 60,
  62, 66, 60, 62, 55, 61, 62, 24, 25, 65, 65, 65, 57, 101, 71, 64, 73, 70, 61,
  58, 74, 72, 26, 56, 69, 56, 89, 73, 75, 63, 75, 65, 65, 64, 70, 71, 100, 70,
  69, 63, 33, 36, 33, 46, 48, 29, 55, 60, 56, 60, 56, 37, 60, 59, 25, 25, 55,
  25, 88, 59, 58, 60, 60, 37, 52, 37, 59, 55, 82, 54, 55, 52, 44, 35, 44, 65,
]
// Stejné prostrkání (v em) pro nadpis i titulky, aby velké písmo drželo jeden tón.
const TRACKING = -0.04
// Krátké jméno by jinak přerostlo do obřího písma.
const HEADING_MAX = 124

function glyphWidth(ch: string): number {
  // Diakritika má šířku základního písmene („č" = „c").
  const code = ch.normalize("NFD").charCodeAt(0) - 32
  return code >= 0 && code < HEADING_W.length ? HEADING_W[code] / 100 : 0.6
}

/** Velikost písma, při které nadpis vyplní celou šířku obsahu. */
function headingSize(text: string): number {
  const em = [...text].reduce((sum, ch) => sum + glyphWidth(ch) + TRACKING, 0)
  return Math.min(HEADING_MAX, (CONTENT_W * 0.97) / em)
}

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontWeight: REGULAR,
    fontSize: TEXT,
    color: c.ink,
    backgroundColor: c.paper,
    paddingTop: MARGIN - UNIT,
    paddingBottom: MARGIN,
    paddingHorizontal: MARGIN,
    lineHeight: 1.4,
  },

  row: { flexDirection: "row", columnGap: GUTTER },
  section: { marginTop: 6 * UNIT },

  heading: { fontWeight: BOLD, lineHeight: 1, marginTop: -4 },
  title: {
    fontSize: TITLE,
    fontWeight: BOLD,
    letterSpacing: TRACKING * TITLE,
    lineHeight: 1,
  },
  label: { fontSize: SMALL, color: c.muted, marginBottom: UNIT / 2 },
  bold: { fontWeight: BOLD },
  muted: { color: c.muted },
  right: { textAlign: "right" },

  item: { paddingVertical: UNIT * 0.75 },
  sumRow: { flexDirection: "row", justifyContent: "space-between" },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 2 * UNIT,
  },
  // react-pdf neumí zarovnat na účaří; posun srovná text s velkou částkou
  // vedle (změřeno pro TEXT 9,5 vedle TITLE 24).
  dueLabel: { fontWeight: BOLD, lineHeight: 1, position: "relative", top: 7 },

  spacer: { flexGrow: 1, minHeight: 6 * UNIT },

  qr: { width: 80, height: 80 },
  footer: { fontSize: SMALL, lineHeight: 1.45, marginTop: 6 * UNIT },
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
  const paymentMethod = invoice.paymentMethod || "Převodem"

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

  return (
    <Document title={`Faktura ${invoice.number}`}>
      <Page size="A4" style={s.page}>
        <Text
          style={[
            s.heading,
            { fontSize: headingPt, letterSpacing: TRACKING * headingPt },
          ]}
        >
          {heading}
        </Text>

        {/* Odsazení počítá s dotahy (j, g, p), aby nesahaly do dalšího bloku. */}
        <View style={[s.row, { marginTop: headingPt * 0.22 + 4 * UNIT }]}>
          <View style={{ width: span(6) }}>
            <Text style={s.title}>Faktura</Text>
            <Text style={[s.bold, { marginTop: UNIT }]}>
              č. {invoice.number}
            </Text>
            {vatPayer ? <Text style={s.muted}>Daňový doklad</Text> : null}
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
            <Field key={label} label={label} value={value} />
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
            <View key={item.id} style={[s.row, s.item]} wrap={false}>
              <View style={{ width: span(cols.desc) }}>
                <Text style={s.bold}>{title}</Text>
                {subs.map((sub, i) => (
                  <Text key={i} style={s.muted}>
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
              <Text style={[s.right, s.bold, { width: span(cols.total) }]}>
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
              <Text style={s.title}>{formatCZK(totals.total)}</Text>
            </View>
          </View>
        </View>

        <View style={s.spacer} />

        <View wrap={false}>
          <View style={s.row}>
            <View style={{ width: span(3) }}>
              <Text style={s.title}>Platba</Text>
              <Text style={[s.bold, { marginTop: UNIT }]}>{paymentMethod}</Text>
            </View>
            <View style={{ width: span(3) }}>
              {qrDataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image style={s.qr} src={qrDataUrl} />
              ) : null}
            </View>
            <View style={{ width: span(6), rowGap: 2 * UNIT }}>
              <View style={s.row}>
                <Field label="Číslo účtu" value={profile.bankAccount} />
                <Field
                  label="Variabilní symbol"
                  value={invoice.variableSymbol}
                />
              </View>
              {iban ? (
                <View style={s.row}>
                  <Field label="IBAN" value={groupIban(iban)} span={6} />
                </View>
              ) : null}
              <View style={s.row}>
                <Field
                  label="Splatnost"
                  value={formatDateLong(invoice.dueDate)}
                />
                <Field label="Částka" value={formatCZK(totals.total)} />
              </View>
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

/** Popisek nad tučnou hodnotou — jediný vzor pro všechny údaje na listu. */
function Field({
  label,
  value,
  span: cols = 3,
}: {
  label: string
  value: string
  span?: number
}) {
  return (
    <View style={{ width: span(cols) }}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.bold}>{value || "—"}</Text>
    </View>
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
      <Text style={s.bold}>{name || "—"}</Text>
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
