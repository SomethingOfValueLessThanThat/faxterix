// Parser notifikačních emailů z Raiffeisenbank ("Informuj mě" → "Pohyb na účtě").
//
// Email má strukturu „popisek, hodnota poblíž":
//
//   Variabilní symbol
//   2026003
//   ...
//   Částka v měně účtu
//   +11,00 CZK
//   ...
//   Typ pohybu
//   Příchozí úhrada
//
// Raiffka posílá HTML-only email, takže CloudMailin má prázdné `plain` a tělo je
// v `html`. `htmlToText` převede HTML na řádkový text, který pak parsujeme.
// Modul je čistý (žádné DOM/Node API), takže ho lze importovat i v Convex runtime.

export interface ParsedPayment {
  /** Variabilní symbol (= číslo/VS faktury). */
  vs: string
  /** Částka v účetní měně, kladná = příchozí. */
  amount: number
  /** Měna, např. "CZK". */
  currency: string
  /** True u příchozích úhrad. */
  isIncoming: boolean
  /** Datum a čas připsání jako ISO řetězec, nebo null. */
  receivedAt: string | null
}

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
}

/** Dekóduje běžné HTML entity (pojmenované i číselné). */
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const num =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10)
      return Number.isFinite(num) ? String.fromCodePoint(num) : m
    }
    return ENTITIES[code.toLowerCase()] ?? m
  })
}

/** Převede HTML na řádkový prostý text (popisky/hodnoty na samostatných řádcích). */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
      // blokové prvky a buňky tabulky → zalomení řádku
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*(p|div|tr|td|th|li|h[1-6]|table|thead|tbody)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Od řádku s popiskem (včetně zbytku téhož řádku) prohledá několik dalších
 * řádků a vrátí první shodu hodnoty.
 */
function scanFromLabel(
  lines: string[],
  label: RegExp,
  value: RegExp,
  maxAhead = 4
): RegExpMatchArray | null {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue
    const end = Math.min(lines.length, i + 1 + maxAhead)
    for (let j = i; j < end; j++) {
      const hay = j === i ? lines[j].replace(label, "") : lines[j]
      const m = hay.match(value)
      if (m) return m
    }
  }
  return null
}

/** Naparsuje českou částku "11,00", "1 234,50", "+11,00", "2.000,00". */
export function parseCzAmount(raw: string): number | null {
  const sign = /^\s*-/.test(raw) ? -1 : 1
  const numeric = raw
    .replace(/[^\d\s.,]/g, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
  const value = parseFloat(numeric)
  return Number.isFinite(value) ? sign * Math.abs(value) : null
}

/** "15. 06. 2026 02:29" → ISO řetězec, nebo null. */
function parseCzDateTime(raw: string): string | null {
  const m = raw.match(
    /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\D+(\d{1,2}):(\d{2}))?/
  )
  if (!m) return null
  const [, d, mo, y, h = "0", min = "0"] = m
  const date = new Date(+y, +mo - 1, +d, +h, +min)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Naparsuje tělo Raiffka emailu (prostý text; pro HTML použij nejdřív
 * `htmlToText`). Vrací null, pokud chybí VS nebo částka.
 */
export function parseRaiffeisenEmail(text: string): ParsedPayment | null {
  if (!text) return null
  // Raiffka prokládá popisky a hodnoty spoustou prázdných řádků – zahodíme je,
  // ať je hodnota vždy hned za svým popiskem.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // VS: od popisku „Variabilní symbol" první skupina aspoň 2 číslic.
  const vsMatch = scanFromLabel(lines, /variabiln[íi]\s+symbol/i, /\d{2,}/)
  const vs = vsMatch?.[0] ?? null
  if (!vs) return null

  // Částka: od popisku „Částka" první peněžní hodnota (s případným +/- a měnou).
  const amountMatch = scanFromLabel(
    lines,
    /částka/i,
    /([+-]?\d[\d\s.]*,\d{2})\s*([A-Za-z]{3})?/
  )
  if (!amountMatch) return null
  const amount = parseCzAmount(amountMatch[1])
  if (amount === null) return null
  const currency = amountMatch[2]?.toUpperCase() ?? "CZK"

  // Příchozí: dle znaménka +, nebo slova „Příchozí" v těle; odchozí vylučujeme.
  const hasPlus = /^\s*\+/.test(amountMatch[1])
  const incoming = /příchoz/i.test(text)
  const outgoing = /odchoz/i.test(text)
  const isIncoming = incoming || (hasPlus && !outgoing)

  const dateMatch = scanFromLabel(
    lines,
    /datum/i,
    /\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/
  )
  const receivedAt = dateMatch ? parseCzDateTime(dateMatch[0]) : null

  return { vs, amount: Math.abs(amount), currency, isIncoming, receivedAt }
}
