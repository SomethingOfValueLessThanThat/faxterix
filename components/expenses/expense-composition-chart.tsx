"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Sensitive } from "@/components/ui/sensitive"
import { cn } from "@/lib/utils"
import { formatCZK } from "@/lib/format"
import type { ExpenseBreakdown } from "@/lib/expenses"

// Kategoriální paleta (viz globals.css). Přiřazuje se v pevném pořadí, necyklí
// se přes víc než šest barev – další položky spadnou do „Ostatní".
const PALETTE = [
  "var(--expense-1)",
  "var(--expense-2)",
  "var(--expense-3)",
  "var(--expense-4)",
  "var(--expense-5)",
  "var(--expense-6)",
]
const MAX_SLICES = PALETTE.length - 1 // poslední barvu necháme pro „Ostatní"

interface Slice {
  id: string
  name: string
  monthly: number
  share: number
  fill: string
}

/** Sloučí položky nad limit do jedné výseče „Ostatní", ať graf zůstane čitelný. */
function toSlices(breakdown: ExpenseBreakdown[]): Slice[] {
  if (breakdown.length <= PALETTE.length) {
    return breakdown.map((b, i) => ({
      id: b.id,
      name: b.name,
      monthly: b.monthly,
      share: b.share,
      fill: PALETTE[i],
    }))
  }
  const head = breakdown.slice(0, MAX_SLICES).map((b, i) => ({
    id: b.id,
    name: b.name,
    monthly: b.monthly,
    share: b.share,
    fill: PALETTE[i],
  }))
  const rest = breakdown.slice(MAX_SLICES)
  const restMonthly = rest.reduce((s, b) => s + b.monthly, 0)
  const restShare = rest.reduce((s, b) => s + b.share, 0)
  return [
    ...head,
    {
      id: "__other__",
      name: `Ostatní (${rest.length})`,
      monthly: Math.round(restMonthly * 100) / 100,
      share: Math.round(restShare * 10) / 10,
      fill: PALETTE[MAX_SLICES],
    },
  ]
}

export function ExpenseCompositionChart({
  breakdown,
  monthlyTotal,
}: {
  breakdown: ExpenseBreakdown[]
  monthlyTotal: number
}) {
  const slices = React.useMemo(() => toSlices(breakdown), [breakdown])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const active = slices.find((s) => s.id === activeId) ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Složení výdajů</CardTitle>
        <CardDescription>Podíl jednotlivých položek na měsíci</CardDescription>
      </CardHeader>
      <CardContent className="grid items-center gap-8 sm:grid-cols-[minmax(0,240px)_1fr]">
        {/* Prstenec */}
        <div className="relative mx-auto aspect-square w-full max-w-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="monthly"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="66%"
                outerRadius="100%"
                paddingAngle={slices.length > 1 ? 2 : 0}
                cornerRadius={6}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive
                animationDuration={700}
                onMouseLeave={() => setActiveId(null)}
              >
                {slices.map((s) => (
                  <Cell
                    key={s.id}
                    fill={s.fill}
                    fillOpacity={
                      activeId === null || activeId === s.id ? 1 : 0.25
                    }
                    onMouseEnter={() => setActiveId(s.id)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Střed prstence: celkový, nebo detail najeté položky. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active?.id ?? "total"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="flex flex-col items-center"
              >
                <span className="max-w-full truncate text-xs text-muted-foreground">
                  {active ? active.name : "Měsíčně"}
                </span>
                <Sensitive className="mt-0.5 text-lg tracking-tight tabular-nums">
                  {formatCZK(active ? active.monthly : monthlyTotal)}
                </Sensitive>
                {active && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {active.share} %
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Žebříček položek: barva + název + proporční pruh + částka. */}
        <ul className="flex flex-col gap-1">
          {slices.map((s, i) => {
            const dimmed = activeId !== null && activeId !== s.id
            return (
              <li key={s.id}>
                <div
                  onMouseEnter={() => setActiveId(s.id)}
                  onMouseLeave={() => setActiveId(null)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors",
                    activeId === s.id && "bg-muted/60",
                    dimmed && "opacity-45"
                  )}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.fill }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{s.name}</span>
                      <Sensitive className="shrink-0 text-sm tabular-nums">
                        {formatCZK(s.monthly)}
                      </Sensitive>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: s.fill }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(s.share, 1.5)}%` }}
                          transition={{
                            duration: 0.7,
                            ease: [0.22, 1, 0.36, 1],
                            delay: 0.1 + i * 0.05,
                          }}
                        />
                      </div>
                      <span className="w-11 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {s.share} %
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
