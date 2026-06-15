// České formátovací pomocníky.

export function formatCZK(value: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(d)
}

/** Datum jako `YYYY-MM-DD` v lokálním čase (ne UTC, aby se den neposouval). */
export function toLocalISODate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function todayISO(): string {
  return toLocalISODate(new Date())
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return toLocalISODate(d)
}

/** Formátování IČO jako 8 číslic. */
export function formatIco(ico: string): string {
  return ico.replace(/\s+/g, "")
}

/**
 * Sanitizuje a formátuje české telefonní číslo. Povolí pouze číslice a volitelnou
 * mezinárodní předvolbu (`+420` / `00420`). Národní číslo (9 číslic) seskupí po
 * trojicích: `123 456 789`, popř. `+420 123 456 789`.
 */
export function formatCzechPhone(input: string): string {
  const intl = /^\s*(\+|00)/.test(input)
  let digits = input.replace(/\D/g, "")

  if (intl) {
    if (digits.startsWith("00")) digits = digits.slice(2)
    const cc = digits.slice(0, 3)
    const national = group3(digits.slice(3, 12))
    return national ? `+${cc} ${national}` : `+${cc}`
  }
  return group3(digits.slice(0, 9))
}

/** Seskupí číslice po trojicích oddělených mezerou. */
function group3(digits: string): string {
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ")
}
