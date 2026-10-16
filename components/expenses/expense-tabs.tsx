"use client"

// Hlavní karta stránky /expenses s taby „Platby" (měsíční checklist) a
// „Všechny výdaje" (seznam). Záložka Platby ukazuje počítadlo aktuálního
// měsíce, ať je stav vidět i z druhého tabu.

import * as React from "react"
import { motion } from "motion/react"
import { Check } from "lucide-react"

import { transitions } from "@/components/motion"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExpenseList } from "@/components/expenses/expense-list"
import {
  ItemPicker,
  PaymentChecklistPanel,
  usePaymentChecklist,
} from "@/components/expenses/payment-checklist"
import { PaymentMonth } from "@/components/expenses/payment-month"
import { cn } from "@/lib/utils"
import type { ChecklistItem } from "@/lib/expenses"
import type { Expense } from "@/lib/types"

type Tab = "payments" | "expenses"

export function ExpenseTabs({
  candidates,
  expenses,
  onEdit,
  flatTaxMonthly,
  flatTaxInChecklist,
}: {
  candidates: ChecklistItem[]
  expenses: Expense[]
  onEdit: (expense: Expense) => void
  flatTaxMonthly: number
  flatTaxInChecklist: boolean
}) {
  const checklist = usePaymentChecklist(candidates)
  const [tab, setTab] = React.useState<Tab>("payments")
  // Bez měsíčních výdajů nemá checklist co ukázat – zůstane jen seznam.
  const hasPayments = candidates.length > 0
  const active: Tab = hasPayments ? tab : "expenses"

  const { current } = checklist
  const currentDone = current.total > 0 && current.paid === current.total
  const expenseCount = expenses.length + (flatTaxMonthly > 0 ? 1 : 0)

  return (
    <Card>
      <Tabs value={active} onValueChange={(value) => setTab(value as Tab)}>
        <div className="flex items-center justify-between gap-3 px-(--card-spacing)">
          <TabsList className="rounded-2xl">
            {hasPayments && (
              <TabButton value="payments" active={active === "payments"}>
                Platby
                {checklist.hasAny && (
                  <TabMeta tone={currentDone ? "success" : "default"}>
                    {currentDone ? (
                      <Check className="size-3.5" strokeWidth={2.8} />
                    ) : (
                      `${current.paid}/${current.total}`
                    )}
                  </TabMeta>
                )}
              </TabButton>
            )}
            <TabButton value="expenses" active={active === "expenses"}>
              <span className="hidden sm:inline">Všechny výdaje</span>
              <span className="sm:hidden">Výdaje</span>
              <TabMeta>{expenseCount}</TabMeta>
            </TabButton>
          </TabsList>

          {active === "payments" && checklist.hasAny && (
            <ItemPicker
              candidates={candidates}
              currentMonth={checklist.currentMonth}
            />
          )}
        </div>

        {hasPayments && (
          <TabsContent value="payments" className="px-(--card-spacing)">
            <TabFade>
              <PaymentChecklistPanel state={checklist}>
                <PaymentMonth state={checklist} />
              </PaymentChecklistPanel>
            </TabFade>
          </TabsContent>
        )}
        <TabsContent value="expenses" className="px-(--card-spacing)">
          <TabFade>
            <ExpenseList
              expenses={expenses}
              onEdit={onEdit}
              flatTaxMonthly={flatTaxMonthly}
              flatTaxInChecklist={flatTaxInChecklist}
            />
          </TabFade>
        </TabsContent>
      </Tabs>
    </Card>
  )
}

/** Záložka s klouzajícím pozadím (stejný vzor jako přepínač periody). */
function TabButton({
  value,
  active,
  children,
}: {
  value: Tab
  active: boolean
  children: React.ReactNode
}) {
  return (
    <TabsTrigger
      value={value}
      className="relative rounded-xl px-3.5 py-1.5 whitespace-nowrap data-[active]:bg-transparent data-[active]:shadow-none"
    >
      {active && (
        <motion.span
          layoutId="expense-tab-active"
          className="absolute inset-0 rounded-xl bg-background shadow-xs ring-1 ring-foreground/10"
          transition={transitions.spring}
        />
      )}
      <span className="relative flex items-center gap-2">{children}</span>
    </TabsTrigger>
  )
}

function TabMeta({
  tone = "default",
  children,
}: {
  tone?: "default" | "success"
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums",
        tone === "success"
          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "bg-foreground/5 text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

/** Jemné nabíhání obsahu při přepnutí tabu (panel se při přepnutí mountuje). */
function TabFade({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.easeOut}
    >
      {children}
    </motion.div>
  )
}
