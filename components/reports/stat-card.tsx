import * as React from "react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

/** Karta s jedním KPI: popisek, hodnota a volitelná ikona / doplněk. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  hint?: React.ReactNode
  className?: string
}) {
  return (
    <Card size="sm" className={className}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-xl tracking-tight">{value}</p>
          {hint ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <Icon className={cn("size-5 shrink-0 text-muted-foreground")} />
        ) : null}
      </CardContent>
    </Card>
  )
}
