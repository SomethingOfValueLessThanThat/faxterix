"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { Trash2, Settings } from "lucide-react"
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
}: {
  expenses: Expense[]
  onEdit: (expense: Expense) => void
  /** Měsíční paušální daň z nastavení – zobrazí se jako výdaj „jen ke čtení". */
  flatTaxMonthly?: number
}) {
  return (
    <div className="rounded-xl bg-card px-2 py-2 text-sm text-card-foreground shadow-xs ring-1 ring-foreground/10">
      <ul>
        {flatTaxMonthly > 0 && <FlatTaxRow amount={flatTaxMonthly} />}
        <AnimatePresence initial={false} mode="popLayout">
          {expenses.map((expense) => (
            <ExpenseRow key={expense._id} expense={expense} onEdit={onEdit} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}

/** Řádek paušální daně – hodnota se bere z Nastavení, edituje se tam. */
function FlatTaxRow({ amount }: { amount: number }) {
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
        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate">Paušální daň</span>
            <Badge variant="outline" className="shrink-0">
              Z nastavení
            </Badge>
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
        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate">{expense.name}</span>
            <Badge variant={yearly ? "info" : "outline"} className="shrink-0">
              {yearly ? "Ročně" : "Měsíčně"}
            </Badge>
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
