"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { Trash2, Settings, ListChecks } from "lucide-react"
import { toast } from "sonner"

import { transitions } from "@/components/motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sensitive } from "@/components/ui/sensitive"
import { useExpenseApi } from "@/lib/store"
import { monthlyEquivalent } from "@/lib/expenses"
import { formatCZK } from "@/lib/format"
import { routes } from "@/lib/routes"
import type { Expense } from "@/lib/types"

export function ExpenseList({
  expenses,
  onEdit,
  flatTaxMonthly = 0,
  flatTaxInChecklist = false,
}: {
  expenses: Expense[]
  onEdit: (expense: Expense) => void
  /** Měsíční paušální daň z nastavení – zobrazí se jako výdaj „jen ke čtení". */
  flatTaxMonthly?: number
  flatTaxInChecklist?: boolean
}) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {flatTaxMonthly > 0 && (
        <FlatTaxRow amount={flatTaxMonthly} inChecklist={flatTaxInChecklist} />
      )}
      <AnimatePresence initial={false} mode="popLayout">
        {expenses.map((expense) => (
          <ExpenseRow key={expense._id} expense={expense} onEdit={onEdit} />
        ))}
      </AnimatePresence>
    </ul>
  )
}

/** Řádek paušální daně – hodnota se bere z Nastavení, edituje se tam. */
function FlatTaxRow({
  amount,
  inChecklist,
}: {
  amount: number
  inChecklist: boolean
}) {
  const router = useRouter()
  const goToSettings = () => router.push(routes.settings)

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={goToSettings}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            goToSettings()
          }
        }}
        className="flex h-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 ring-1 ring-foreground/10 transition-colors ring-inset hover:bg-muted/40 hover:ring-foreground/20"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate">Paušální daň</span>
            <Badge variant="outline" className="shrink-0">
              Z nastavení
            </Badge>
            {inChecklist && <ChecklistMark />}
          </div>
        </div>

        <div className="text-right">
          <p className="tracking-tight tabular-nums">
            <Sensitive>{formatCZK(amount)}</Sensitive>
          </p>
          <p className="text-xs text-muted-foreground">za měsíc</p>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation()
            goToSettings()
          }}
          aria-label="Upravit paušální daň v nastavení"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Settings />
        </Button>
      </div>
    </li>
  )
}

function ExpenseRow({
  expense,
  onEdit,
}: {
  expense: Expense
  onEdit: (expense: Expense) => void
}) {
  const api = useExpenseApi()
  const yearly = expense.period === "yearly"

  async function remove(e: React.MouseEvent) {
    e.stopPropagation()
    await api.remove(expense._id)
    toast.success("Výdaj smazán.")
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={transitions.easeOut}
      className="overflow-hidden"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onEdit(expense)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onEdit(expense)
          }
        }}
        className="flex h-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 ring-1 ring-foreground/10 transition-colors ring-inset hover:bg-muted/40 hover:ring-foreground/20"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate">{expense.name}</span>
            <Badge variant={yearly ? "info" : "outline"} className="shrink-0">
              {yearly ? "Ročně" : "Měsíčně"}
            </Badge>
            {expense.checklistSince && <ChecklistMark />}
          </div>
          {yearly && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              <Sensitive className="tabular-nums">
                {formatCZK(expense.amount)}
              </Sensitive>{" "}
              za rok
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="tracking-tight tabular-nums">
            <Sensitive>{formatCZK(monthlyEquivalent(expense))}</Sensitive>
          </p>
          <p className="text-xs text-muted-foreground">za měsíc</p>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={remove}
          aria-label={`Smazat výdaj ${expense.name}`}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>
    </motion.li>
  )
}

/** Značka, že se výdaj odškrtává v měsíčním checklistu plateb. */
function ChecklistMark() {
  return (
    <ListChecks
      aria-label="V checklistu plateb"
      className="size-3.5 shrink-0 text-muted-foreground"
    />
  )
}
