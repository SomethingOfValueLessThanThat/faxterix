"use client"

import * as React from "react"
import {
  Plus,
  Wallet,
  CalendarClock,
  CalendarDays,
  Repeat,
} from "lucide-react"

import { PageContainer } from "@/components/page-container"
import { PageHeader } from "@/components/page-header"
import { FadeIn, Stagger, StaggerItem, transitions } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { Sensitive } from "@/components/ui/sensitive"
import { StatCard } from "@/components/reports/stat-card"
import { ExpenseCompositionChart } from "@/components/expenses/expense-composition-chart"
import { ExpenseList } from "@/components/expenses/expense-list"
import { ExpenseDialog } from "@/components/expenses/expense-dialog"
import { useExpenses, useProfile } from "@/lib/store"
import { expenseSummary, expenseBreakdown } from "@/lib/expenses"
import { formatCZK } from "@/lib/format"
import type { Expense } from "@/lib/types"

// Syntetický výdaj pro paušální daň – hodnota se bere z Nastavení. Do CRUD
// tabulky se neukládá, edituje se v Nastavení, proto ho v seznamu řešíme zvlášť.
const FLAT_TAX_ID = "__flat_tax__"

export function ExpensesView() {
  const expenses = useExpenses()
  const profile = useProfile()
  const flatTaxMonthly = profile.flatTaxMonthly
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Expense | null>(null)

  // Do souhrnů a grafu započítáme i paušální daň jako běžný měsíční výdaj.
  const allExpenses = React.useMemo<Expense[]>(() => {
    if (flatTaxMonthly <= 0) return expenses
    const flatTax: Expense = {
      _id: FLAT_TAX_ID,
      name: "Paušální daň",
      amount: flatTaxMonthly,
      period: "monthly",
      createdAt: 0,
      updatedAt: 0,
    }
    return [flatTax, ...expenses]
  }, [expenses, flatTaxMonthly])

  const summary = React.useMemo(
    () => expenseSummary(allExpenses),
    [allExpenses]
  )
  const breakdown = React.useMemo(
    () => expenseBreakdown(allExpenses),
    [allExpenses]
  )

  const hasContent = expenses.length > 0 || flatTaxMonthly > 0

  function openAdd() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(expense: Expense) {
    setEditing(expense)
    setDialogOpen(true)
  }

  return (
    <PageContainer>
      <PageHeader
        title="Výdaje"
        description="Pravidelné náklady a jejich přepočet na měsíc"
        actions={
          <Button onClick={openAdd}>
            <Plus strokeWidth={2.8} />
            Přidat výdaj
          </Button>
        }
      />

      {!hasContent ? (
        <FadeIn className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <Wallet className="size-8 text-muted-foreground" />
          <h2 className="mt-4">Zatím žádné výdaje</h2>
          <p className="mt-1 max-w-sm text-sm text-balance text-muted-foreground">
            Přidejte pravidelné náklady a uvidíte, kolik vás stojí měsíčně.
          </p>
          <Button onClick={openAdd} className="mt-4">
            <Plus />
            Přidat výdaj
          </Button>
        </FadeIn>
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI karty */}
          <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              <StatCard
                key="monthly"
                label="Měsíčně celkem"
                value={<Sensitive>{formatCZK(summary.monthlyTotal)}</Sensitive>}
                icon={Wallet}
                hint="vč. ročních (přepočet)"
              />,
              <StatCard
                key="yearly"
                label="Ročně celkem"
                value={<Sensitive>{formatCZK(summary.yearlyTotal)}</Sensitive>}
                icon={CalendarDays}
                hint="měsíční přepočet × 12"
              />,
              <StatCard
                key="recurring"
                label="Měsíční položky"
                value={
                  <Sensitive>{formatCZK(summary.monthlyRecurring)}</Sensitive>
                }
                icon={Repeat}
                hint={`${summary.monthlyCount} ${pluralizeItems(summary.monthlyCount)}`}
              />,
              <StatCard
                key="yearlyAsMonthly"
                label="Roční položky / měs."
                value={
                  <Sensitive>{formatCZK(summary.yearlyAsMonthly)}</Sensitive>
                }
                icon={CalendarClock}
                hint={`${summary.yearlyCount} ${pluralizeItems(summary.yearlyCount)}`}
              />,
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

          {/* Složení výdajů */}
          <FadeIn delay={0.1}>
            <ExpenseCompositionChart
              breakdown={breakdown}
              monthlyTotal={summary.monthlyTotal}
            />
          </FadeIn>

          {/* Seznam */}
          <FadeIn delay={0.16}>
            <ExpenseList
              expenses={expenses}
              onEdit={openEdit}
              flatTaxMonthly={flatTaxMonthly}
            />
          </FadeIn>
        </div>
      )}

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={editing}
      />
    </PageContainer>
  )
}

function pluralizeItems(n: number): string {
  if (n === 1) return "položka"
  if (n >= 2 && n <= 4) return "položky"
  return "položek"
}
