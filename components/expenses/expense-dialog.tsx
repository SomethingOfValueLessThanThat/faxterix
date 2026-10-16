"use client"

import * as React from "react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { transitions } from "@/components/motion"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useExpenseApi } from "@/lib/store"
import { monthKey } from "@/lib/expenses"
import type { Expense, ExpensePeriod } from "@/lib/types"

/** Převede uživatelský vstup na číslo (přijme i desetinnou čárku). */
function parseAmount(raw: string): number {
  return Number(raw.replace(/\s+/g, "").replace(",", "."))
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: Expense | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? "Upravit výdaj" : "Nový výdaj"}</DialogTitle>
          <DialogDescription>
            Zadejte částku a jak často se platí. Roční výdaje se přepočtou na
            měsíc.
          </DialogDescription>
        </DialogHeader>
        {/* Klíč resetuje stav formuláře při každém otevření / změně položky. */}
        {open && (
          <ExpenseForm
            key={expense?._id ?? "new"}
            expense={expense ?? null}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ExpenseForm({
  expense,
  onDone,
}: {
  expense: Expense | null
  onDone: () => void
}) {
  const api = useExpenseApi()
  const nameRef = React.useRef<HTMLInputElement>(null)
  const [name, setName] = React.useState(expense?.name ?? "")
  const [amount, setAmount] = React.useState(
    expense ? String(expense.amount) : ""
  )
  const [period, setPeriod] = React.useState<ExpensePeriod>(
    expense?.period ?? "monthly"
  )
  const [inChecklist, setInChecklist] = React.useState(
    !!expense?.checklistSince
  )
  const [saving, setSaving] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    const value = parseAmount(amount)
    if (!trimmed) {
      toast.error("Zadejte název výdaje.")
      nameRef.current?.focus()
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Zadejte kladnou částku.")
      return
    }
    // Checklist je jen pro měsíční výdaje; už zařazený výdaj si drží původní
    // měsíc, aby se mu nezahodila historie.
    const checklistSince =
      period === "monthly" && inChecklist
        ? (expense?.checklistSince ?? monthKey())
        : null
    setSaving(true)
    try {
      if (expense) {
        await api.patch(expense._id, {
          name: trimmed,
          amount: value,
          period,
          checklistSince,
        })
        toast.success("Výdaj upraven.")
      } else {
        await api.create({
          name: trimmed,
          amount: value,
          period,
          checklistSince: checklistSince ?? undefined,
        })
        toast.success("Výdaj přidán.")
      }
      onDone()
    } catch {
      toast.error("Uložení se nezdařilo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Název</Label>
        <Input
          ref={nameRef}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nájem, software, pojištění…"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Částka (Kč)</Label>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Perioda</Label>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      {period === "monthly" && (
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2.5 ring-1 ring-foreground/10">
          <span className="min-w-0">
            <span className="block text-sm">Odškrtávat každý měsíc</span>
            <span className="block text-xs text-muted-foreground">
              Platím ručně – hlídat v checklistu plateb
            </span>
          </span>
          <Switch checked={inChecklist} onCheckedChange={setInChecklist} />
        </label>
      )}

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Zrušit
        </Button>
        <Button type="submit" disabled={saving}>
          {expense ? "Uložit" : "Přidat výdaj"}
        </Button>
      </DialogFooter>
    </form>
  )
}

const PERIOD_OPTIONS: { value: ExpensePeriod; label: string }[] = [
  { value: "monthly", label: "Měsíčně" },
  { value: "yearly", label: "Ročně" },
]

function PeriodToggle({
  value,
  onChange,
}: {
  value: ExpensePeriod
  onChange: (v: ExpensePeriod) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
      {PERIOD_OPTIONS.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className="relative rounded-xl px-3 py-2 text-sm transition-colors"
          >
            {active && (
              <motion.span
                layoutId="period-active"
                className="absolute inset-0 rounded-xl bg-background shadow-xs ring-1 ring-foreground/10"
                transition={transitions.spring}
              />
            )}
            <span
              className={cn(
                "relative",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
