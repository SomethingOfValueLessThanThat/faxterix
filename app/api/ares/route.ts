// Načtení údajů firmy z registru ARES podle IČO.
// Veřejné API: https://ares.gov.cz/ekonomicke-subjekty-v-be/rest

import { NextResponse } from "next/server"

interface AresSidlo {
  nazevUlice?: string
  cisloDomovni?: number
  cisloOrientacni?: number
  nazevObce?: string
  nazevCastiObce?: string
  psc?: number
  textovaAdresa?: string
}

interface AresResponse {
  obchodniJmeno?: string
  ico?: string
  dic?: string
  sidlo?: AresSidlo
}

function buildStreet(sidlo: AresSidlo): string {
  if (sidlo.nazevUlice) {
    const num = [sidlo.cisloDomovni, sidlo.cisloOrientacni]
      .filter(Boolean)
      .join("/")
    return [sidlo.nazevUlice, num].filter(Boolean).join(" ").trim()
  }
  // Obce bez uličního systému
  if (sidlo.nazevCastiObce && sidlo.cisloDomovni)
    return `${sidlo.nazevCastiObce} ${sidlo.cisloDomovni}`
  return sidlo.textovaAdresa ?? ""
}

function formatPsc(psc?: number): string {
  if (!psc) return ""
  const s = String(psc).padStart(5, "0")
  return `${s.slice(0, 3)} ${s.slice(3)}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ico = (searchParams.get("ico") ?? "").replace(/\s+/g, "")

  if (!/^\d{8}$/.test(ico)) {
    return NextResponse.json(
      { error: "IČO musí mít 8 číslic." },
      { status: 400 }
    )
  }

  try {
    const res = await fetch(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
      { headers: { Accept: "application/json" } }
    )

    if (res.status === 404) {
      return NextResponse.json(
        { error: "Subjekt s tímto IČO nebyl nalezen." },
        { status: 404 }
      )
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: "ARES je momentálně nedostupný." },
        { status: 502 }
      )
    }

    const data = (await res.json()) as AresResponse
    const sidlo = data.sidlo ?? {}

    return NextResponse.json({
      name: data.obchodniJmeno ?? "",
      ico: data.ico ?? ico,
      dic: data.dic ?? "",
      address: {
        street: buildStreet(sidlo),
        city: sidlo.nazevObce ?? "",
        zip: formatPsc(sidlo.psc),
        country: "Česká republika",
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Nepodařilo se spojit s ARES." },
      { status: 502 }
    )
  }
}
