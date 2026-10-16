"use client"

// Karta v editoru faktury: ukáže, kam faktura posune příjmy vůči limitu pásma
// paušální daně, a když limit překročí, kolik navíc to bude stát na paušálu.

import * as React from "react"
import { TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Sensitive } from "@/components/ui/sensitive"
import { formatCZK } from "@/lib/format"
import { invoiceBandImpact } from "@/lib/reports"
import { cn } from "@/lib/utils"
import type { CompanyProfile, Invoice } from "@/lib/types"

export function BandImpact({
  invoice,
  invoices,
  profile,
}: {
  invoice: Invoice
  invoices: Invoice[]
  profile: CompanyProfile
}) {
  const impact = React.useMemo(
    () =>
      invoiceBandImpact(
        invoice,
        invoices,
        profile.selectedBand,
        profile.bandLimits
      ),
    [invoice, invoices, profile.selectedBand, profile.bandLimits]
  )
  const { band, limit, before, after, newBand, status } = impact
  const alreadyOver = before > limit
  const width = (n: number) => `${Math.min((n / limit) * 100, 100)}%`
  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm">
          Limit {band}. pásma · {impact.year}
        </h2>
        {status !== "ok" && (
          <Badge variant="warning">
            <TriangleAlert />
            {status === "over" ? "Nad limitem" : "Blíží se limit"}
          </Badge>
        )}
      </div>
      <Separator />

      {/* Šedá = ostatní faktury, barevný úsek = tahle faktura. */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
            status === "over" ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: width(after) }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-chart-3 transition-[width] duration-300"
          style={{ width: width(before) }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <Sensitive className="tabular-nums">
          {formatCZK(after)} z {formatCZK(limit)}
        </Sensitive>
        <span className="tabular-nums">
          {Math.round((after / limit) * 100)} %
        </span>
      </div>

      <div className="space-y-1.5 text-xs">
        {alreadyOver ? (
          <p className="text-destructive">
            Limit je překročený už bez této faktury.
          </p>
        ) : status === "over" ? (
          <p className="text-destructive">
            Touto fakturou limit překročíte o{" "}
            <Sensitive>{formatCZK(after - limit)}</Sensitive>.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Po této faktuře zbývá do limitu{" "}
            <Sensitive>{formatCZK(limit - after)}</Sensitive>.
          </p>
        )}
        {status === "over" &&
          (newBand === null ? (
            <p className="text-destructive">
              Příjmy přesáhnou i limit 3. pásma – paušální režim končí a hrozí
              registrace k DPH.
            </p>
          ) : (
            <p className="text-destructive">
              V {newBand}. pásmu je paušál o{" "}
              <Sensitive>{formatCZK(impact.extraTaxYearly)}</Sensitive> ročně
              vyšší.
            </p>
          ))}
        {impact.year !== currentYear && (
          <p className="text-muted-foreground">
            Splatnost je v roce {impact.year}, faktura se počítá do jeho limitu.
          </p>
        )}
        <p className="text-muted-foreground">
          Vč. nezaplacených faktur podle splatnosti.
        </p>
      </div>
    </div>
  )
}
