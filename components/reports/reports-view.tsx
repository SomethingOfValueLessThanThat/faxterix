"use client"

import * as React from "react"
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  Wallet,
  Clock,
  AlertTriangle,
  Receipt,
  Percent,
  TrendingUp,
} from "lucide-react"

import { PageContainer } from "@/components/page-container"
import { PageHeader } from "@/components/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { StatCard } from "@/components/reports/stat-card"
import { useInvoices, useClients, useProfile } from "@/lib/store"
import { formatCZK } from "@/lib/format"
import {
  summaryStats,
  revenueByMonth,
  yearRevenue,
  bandProgress,
} from "@/lib/reports"

// Kompaktní formát částky pro osy grafů (např. „12 tis.").
const compactCZK = (n: number) =>
  new Intl.NumberFormat("cs-CZ", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n)

const revenueConfig = {
  paid: { label: "Zaplaceno", color: "var(--chart-5)" },
  unpaid: { label: "Nezaplaceno", color: "var(--chart-3)" },
} satisfies ChartConfig


export function ReportsView() {
  const invoices = useInvoices()
  const clients = useClients()
  const profile = useProfile()
  const vatPayer = profile.vatPayer

  const stats = React.useMemo(
    () => summaryStats(invoices, clients, vatPayer),
    [invoices, clients, vatPayer]
  )
  const revenue = React.useMemo(
    () => revenueByMonth(invoices, vatPayer, 12),
    [invoices, vatPayer]
  )
  const yearRev = React.useMemo(
    () => yearRevenue(invoices, vatPayer),
    [invoices, vatPayer]
  )
  const bandProg = React.useMemo(
    () => bandProgress(invoices, vatPayer, profile.selectedBand, profile.bandLimits),
    [invoices, vatPayer, profile.selectedBand, profile.bandLimits]
  )

  return (
    <PageContainer>
      <PageHeader
        title="Reporty"
        description="Přehled tržeb a statistik nad fakturami"
      />

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <TrendingUp className="size-8 text-muted-foreground" />
          <h2 className="mt-4">Zatím není co zobrazit</h2>
          <p className="mt-1 max-w-sm text-sm text-balance text-muted-foreground">
            Reporty se zobrazí, jakmile vystavíte první fakturu.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI karty */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Vyfakturováno za rok"
              value={formatCZK(yearRev)}
              icon={Receipt}
            />
            <StatCard
              label="Zaplaceno"
              value={formatCZK(stats.paid)}
              icon={Wallet}
            />
            <StatCard
              label="Nezaplaceno"
              value={formatCZK(stats.unpaid)}
              icon={Clock}
              hint={
                stats.overdueCount > 0
                  ? `${formatCZK(stats.overdue)} po splatnosti`
                  : "vše v termínu"
              }
            />
            <StatCard
              label="Po splatnosti"
              value={stats.overdueCount}
              icon={AlertTriangle}
              hint={pluralizeInvoices(stats.overdueCount)}
            />
            {vatPayer ? (
              <StatCard
                label="DPH k odvedení"
                value={formatCZK(stats.vat)}
                icon={Percent}
              />
            ) : null}
          </div>

          {/* Tržby po měsících */}
          <Card>
            <CardHeader>
              <CardTitle>Tržby po měsících</CardTitle>
              <CardDescription>Posledních 12 měsíců</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={revenueConfig}
                className="aspect-auto h-[280px] w-full"
              >
                <LineChart data={revenue} margin={{ left: 12, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={compactCZK}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              {revenueConfig[name as keyof typeof revenueConfig]
                                ?.label ?? name}
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {formatCZK(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Line
                    dataKey="paid"
                    type="monotone"
                    stroke="var(--color-paid)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    dataKey="unpaid"
                    type="monotone"
                    stroke="var(--color-unpaid)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Pokrok k pasmu */}
          <Card>
            <CardHeader>
              <CardTitle>Pokrok k {bandProg.band}. pásmu</CardTitle>
              <CardDescription>{formatCZK(bandProg.current)} z {formatCZK(bandProg.limit)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(bandProg.percentage, 100)}%`,
                    background: "linear-gradient(90deg, #4ade80 0%, #facc15 100%)",
                  }}
                />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{bandProg.percentage}%</span>
                <span>zbývá {formatCZK(bandProg.remaining)}</span>
              </div>
            </CardContent>
          </Card>

        </div>
      )}
    </PageContainer>
  )
}

function pluralizeInvoices(n: number): string {
  if (n === 1) return "faktura"
  if (n >= 2 && n <= 4) return "faktury"
  return "faktur"
}
