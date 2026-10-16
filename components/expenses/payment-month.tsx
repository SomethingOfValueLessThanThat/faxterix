"use client"

// Tab „Platby": souhrn aktuálního měsíce (kolik zbývá zaplatit) a odškrtávací
// seznam plateb, největší nahoře.

import * as React from "react"
import { Check } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Sensitive } from "@/components/ui/sensitive"
import {
  paymentLabel,
  useTogglePaid,
  type PaymentChecklistState,
} from "@/components/expenses/payment-checklist"
import { cn } from "@/lib/utils"
import { itemsForMonth, paymentKey } from "@/lib/expenses"
import { formatCZK } from "@/lib/format"

const PAID_TEXT = "text-emerald-600 dark:text-emerald-400"

export function PaymentMonth({ state }: { state: PaymentChecklistState }) {
  const { candidates, currentMonth, index, current: status } = state
  const toggle = useTogglePaid()
  const done = status.total > 0 && status.paid === status.total

  const items = itemsForMonth(candidates, currentMonth)
    .map((item) => ({
      item,
      payment: index.get(paymentKey(item.id, currentMonth)),
      share: status.amount ? (item.amount / status.amount) * 100 : 0,
    }))
    .sort((a, b) => b.item.amount - a.item.amount)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {done ? "Vše zaplaceno" : "Zbývá zaplatit"}
        </p>
        <p
          className={cn(
            "mt-1 flex items-center gap-2 text-3xl tracking-tight tabular-nums sm:text-4xl",
            done && PAID_TEXT
          )}
        >
          {done && <Check className="size-7 sm:size-8" strokeWidth={2.6} />}
          <Sensitive>
            {formatCZK(done ? status.amount : status.remaining)}
          </Sensitive>
        </p>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {status.paid} z {status.total} plateb · celkem{" "}
          <Sensitive>{formatCZK(status.amount)}</Sensitive>
        </p>
      </div>

      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ item, payment, share }) => (
          <li key={item.id}>
            <label className="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
              <Checkbox
                checked={!!payment}
                onCheckedChange={(next) => toggle(item.id, currentMonth, next)}
                className="data-checked:border-emerald-600 data-checked:bg-emerald-600"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.name}</p>
                <p
                  className={cn(
                    "truncate text-xs",
                    payment ? PAID_TEXT : "text-muted-foreground"
                  )}
                >
                  {paymentLabel(payment)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Sensitive className="block text-sm tracking-tight tabular-nums">
                  {formatCZK(item.amount)}
                </Sensitive>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(share)} %
                </span>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
