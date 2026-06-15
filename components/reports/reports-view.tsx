"use client"

import * as React from "react"
import { motion } from "motion/react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  Wallet,
  Clock,
  Receipt,
  Percent,
  TrendingUp,
  BadgePercent,
  FileCheck,
  ClockAlert,
  HandCoins,
} from "lucide-react"

import { PageContainer } from "@/components/page-container"
import { FadeIn, Stagger, StaggerItem, transitions } from "@/components/motion"
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
    () =>
      bandProgress(
        invoices,
        vatPayer,
        profile.selectedBand,
        profile.bandLimits
      ),
    [invoices, vatPayer, profile.selectedBand, profile.bandLimits]
  )

  return (
    <PageContainer>
      <PageHeader
        title="Reporty"
        description="Přehled tržeb a statistik nad fakturami"
      />

      {invoices.length === 0 ? (
        <FadeIn className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <TrendingUp className="size-8 text-muted-foreground" />
          <h2 className="mt-4">Zatím není co zobrazit</h2>
          <p className="mt-1 max-w-sm text-sm text-balance text-muted-foreground">
            Reporty se zobrazí, jakmile vystavíte první fakturu.
          </p>
        </FadeIn>
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI karty */}
          <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              <StatCard
                key="year"
                label="Vyfakturováno za rok"
                value={formatCZK(yearRev)}
                icon={FileCheck}
                hint="zaplacené, posledních 12 měs."
              />,
              <StatCard
                key="paid"
                label="Zaplaceno"
                value={formatCZK(stats.paid)}
                icon={Wallet}
                hint="celkově"
              />,
              <StatCard
                key="unpaid"
                label="Nezaplaceno"
                value={formatCZK(stats.unpaid)}
                icon={ClockAlert}
                hint={
                  stats.overdueCount > 0
                    ? `${formatCZK(stats.overdue)} po splatnosti`
                    : "vše v termínu"
                }
              />,
              <StatCard
                key="flatTax"
                label="Paušální daň za rok"
                value={formatCZK(profile.flatTaxMonthly * 12)}
                icon={HandCoins}
                hint={
                  profile.flatTaxMonthly > 0
                    ? `${formatCZK(profile.flatTaxMonthly)}/měs.`
                    : "nastavte v Nastaveních"
                }
              />,
              ...(vatPayer
                ? [
                    <StatCard
                      key="vat"
                      label="DPH k odvedení"
                      value={formatCZK(stats.vat)}
                      icon={Percent}
                    />,
                  ]
                : []),
            ].map((card) => (
              <StaggerItem
                key={card.key}
                whileHover={{ y: -4 }}
                transition={transitions.spring}
              >
                {card}
              </StaggerItem>
            ))}
          </Stagger>

          {/* Tržby po měsících */}
          <FadeIn delay={0.1}>
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
          </FadeIn>

          {/* Pokrok k pasmu */}
          <FadeIn delay={0.16}>
          <Card>
            <CardHeader>
              <CardTitle>Pokrok k {bandProg.band}. pásmu</CardTitle>
              <CardDescription>
                {formatCZK(bandProg.current)} z {formatCZK(bandProg.limit)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(bandProg.percentage, 100)}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                  style={{
                    background:
                      "linear-gradient(90deg, #4ade80 0%, #facc15 100%)",
                  }}
                />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{bandProg.percentage}%</span>
                <span>zbývá {formatCZK(bandProg.remaining)}</span>
              </div>
            </CardContent>
          </Card>
          </FadeIn>
        </div>
      )}
    </PageContainer>
  )
}
