"use client"

// Měsíční checklist ručně placených výdajů (tab „Platby" na /expenses):
// sdílený stav aktuálního měsíce a pomocné funkce pro `payment-month.tsx`.
// Které výdaje se odškrtávají, se volí v popoveru „Položky" – část výdajů se
// platí sama a hlídat je netřeba.

import * as React from "react"
import { ListChecks, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Sensitive } from "@/components/ui/sensitive"
import { Switch } from "@/components/ui/switch"
import { useExpenseApi, useExpensePayments } from "@/lib/store"
import {
  checklistMonthStatus,
  monthKey,
  paymentIndex,
  type ChecklistItem,
} from "@/lib/expenses"
import { formatCZK, formatDayMonth } from "@/lib/format"
import type { ChecklistItemId, ExpensePayment } from "@/lib/types"

/**
 * Stav checklistu aktuálního měsíce, sdílený mezi panelem a záložkou (ta
 * ukazuje počítadlo), proto žije v hooku a ne přímo v panelu.
 */
export function usePaymentChecklist(candidates: ChecklistItem[]) {
  const currentMonth = monthKey()
  const payments = useExpensePayments(currentMonth)
  const index = React.useMemo(() => paymentIndex(payments), [payments])
  const current = React.useMemo(
    () => checklistMonthStatus(candidates, index, currentMonth),
    [candidates, index, currentMonth]
  )

  return {
    candidates,
    currentMonth,
    index,
    current,
    hasAny: candidates.some((c) => c.since !== null),
  }
}

export type PaymentChecklistState = ReturnType<typeof usePaymentChecklist>

/** Prázdný stav (nic se neodškrtává), jinak obsah tabu. */
export function PaymentChecklistPanel({
  state,
  children,
}: {
  state: PaymentChecklistState
  children: React.ReactNode
}) {
  const { candidates, currentMonth } = state

  if (!state.hasAny) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 text-center">
        <ListChecks className="size-8 text-muted-foreground" />
        <h3 className="mt-4">Zatím nic neodškrtáváte</h3>
        <p className="mt-1 max-w-sm text-sm text-balance text-muted-foreground">
          Vyberte výdaje, které platíte ručně, a každý měsíc si je tu
          odškrtněte.
        </p>
        <ItemPicker
          candidates={candidates}
          currentMonth={currentMonth}
          variant="default"
          label="Vybrat položky"
          className="mt-4"
        />
      </div>
    )
  }

  return <>{children}</>
}

/** Přepnutí zaplacení položky v měsíci; chybu ohlásí toastem. */
export function useTogglePaid() {
  const api = useExpenseApi()
  return React.useCallback(
    async (item: ChecklistItemId, month: string, next: boolean) => {
      try {
        await api.setPaid(item, month, next)
      } catch {
        toast.error("Uložení se nezdařilo.")
      }
    },
    [api]
  )
}

/** „Zaplaceno 9. 10. · z banky" / „Čeká na zaplacení". */
export function paymentLabel(payment: ExpensePayment | undefined): string {
  if (!payment) return "Čeká na zaplacení"
  const bank = payment.source === "bank" ? " · z banky" : ""
  return `Zaplaceno ${formatDayMonth(payment.paidAt)}${bank}`
}

/** Výběr výdajů, které se mají každý měsíc odškrtávat. */
export function ItemPicker({
  candidates,
  currentMonth,
  variant = "outline",
  label,
  className,
}: {
  candidates: ChecklistItem[]
  currentMonth: string
  variant?: "outline" | "default"
  /** Popisek zobrazený vždy; bez něj je na mobilu tlačítko jen ikona. */
  label?: string
  className?: string
}) {
  const api = useExpenseApi()

  async function toggle(id: ChecklistItemId, on: boolean) {
    try {
      await api.setChecklist(id, on ? currentMonth : null)
    } catch {
      toast.error("Uložení se nezdařilo.")
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant={variant}
            size="sm"
            aria-label="Vybrat položky checklistu"
            className={className}
          >
            <SlidersHorizontal />
            {label ?? <span className="hidden sm:inline">Položky</span>}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 gap-3">
        <PopoverHeader>
          <PopoverDescription>
            Zapněte výdaje, které platíte ručně. Co se strhává samo, nechte
            vypnuté. Odchozí platbu se stejnou částkou odškrtne banka sama.
          </PopoverDescription>
        </PopoverHeader>
        {candidates.length === 0 ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <ListChecks className="size-4" />
            Zatím žádné měsíční výdaje.
          </p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {candidates.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <Sensitive className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatCZK(c.amount)}
                  </Sensitive>
                  <Switch
                    checked={c.since !== null}
                    onCheckedChange={(on) => toggle(c.id, on)}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
