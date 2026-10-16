"use client"

// Ruční oprava údajů, které AI vytáhla ze smlouvy. Na nich stojí hlídání
// termínů, proto jde upravit vše, z čeho se termíny počítají.

import * as React from "react"
import { toast } from "sonner"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useClients, useContractApi } from "@/lib/store"
import type { Contract, ContractTerms } from "@/lib/types"

type NoticeUnit = NonNullable<ContractTerms["notice"]>["unit"]

export function ContractDialog({
  contract,
  onOpenChange,
}: {
  contract: Contract | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!contract} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upravit smlouvu</DialogTitle>
          <DialogDescription>
            Zkontrolujte, co AI vytáhla – podle těchto údajů se hlídají termíny.
          </DialogDescription>
        </DialogHeader>
        {contract?.terms && (
          <ContractForm
            key={contract._id}
            contract={contract}
            terms={contract.terms}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Prázdný input → undefined, jinak číslo. */
function toNumber(raw: string): number | undefined {
  const n = Number(raw.replace(",", "."))
  return raw.trim() && Number.isFinite(n) ? n : undefined
}

function ContractForm({
  contract,
  terms,
  onDone,
}: {
  contract: Contract
  terms: ContractTerms
  onDone: () => void
}) {
  const clients = useClients()
  const contractApi = useContractApi()
  const [title, setTitle] = React.useState(contract.title)
  const [clientId, setClientId] = React.useState(contract.clientId ?? "")
  const [summary, setSummary] = React.useState(terms.summary)
  const [startDate, setStartDate] = React.useState(terms.startDate ?? "")
  const [endDate, setEndDate] = React.useState(terms.endDate ?? "")
  const [autoRenewal, setAutoRenewal] = React.useState(terms.autoRenewal)
  const [renewalMonths, setRenewalMonths] = React.useState(
    terms.renewalMonths?.toString() ?? ""
  )
  const [noticeAmount, setNoticeAmount] = React.useState(
    terms.notice?.amount.toString() ?? ""
  )
  const [noticeUnit, setNoticeUnit] = React.useState<NoticeUnit>(
    terms.notice?.unit ?? "months"
  )
  const [rate, setRate] = React.useState(terms.rate ?? "")
  const [paymentDays, setPaymentDays] = React.useState(
    terms.paymentDays?.toString() ?? ""
  )
  const [confidentialityUntil, setConfidentialityUntil] = React.useState(
    terms.confidentialityUntil ?? ""
  )
  const [saving, setSaving] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Zadejte název smlouvy.")
      return
    }
    const notice = toNumber(noticeAmount)
    setSaving(true)
    try {
      await contractApi.patch(contract._id, {
        title: title.trim(),
        clientId: clientId || null,
        terms: {
          ...terms,
          summary: summary.trim(),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          autoRenewal,
          renewalMonths: autoRenewal ? toNumber(renewalMonths) : undefined,
          notice: notice ? { amount: notice, unit: noticeUnit } : undefined,
          rate: rate.trim() || undefined,
          paymentDays: toNumber(paymentDays),
          confidentialityUntil: confidentialityUntil || undefined,
        },
      })
      toast.success("Smlouva upravena.")
      onDone()
    } catch {
      toast.error("Uložení se nezdařilo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Název">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="Klient">
        <Select
          value={clientId}
          onValueChange={(v) => setClientId(String(v ?? ""))}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {(id: string | null) =>
                id
                  ? (clients.find((c) => c._id === id)?.name ?? "")
                  : `Nespárováno (${terms.counterparty})`
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Nespárováno</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Začátek">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="Konec (prázdné = doba neurčitá)">
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2.5 ring-1 ring-foreground/10">
        <span className="text-sm">Automaticky se prodlužuje</span>
        <Switch checked={autoRenewal} onCheckedChange={setAutoRenewal} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        {autoRenewal && (
          <Field label="Prodlužuje se o (měsíců)">
            <Input
              type="number"
              min={1}
              value={renewalMonths}
              onChange={(e) => setRenewalMonths(e.target.value)}
              placeholder="12"
            />
          </Field>
        )}
        <Field label="Výpovědní lhůta">
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              value={noticeAmount}
              onChange={(e) => setNoticeAmount(e.target.value)}
              className="w-20"
            />
            <Select
              value={noticeUnit}
              onValueChange={(v) => setNoticeUnit(v as NoticeUnit)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue>
                  {(v: NoticeUnit) => (v === "days" ? "dní" : "měsíců")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">dní</SelectItem>
                <SelectItem value="months">měsíců</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sazba">
          <Input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="1 200 Kč/h"
          />
        </Field>
        <Field label="Splatnost (dní)">
          <Input
            type="number"
            min={0}
            value={paymentDays}
            onChange={(e) => setPaymentDays(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Mlčenlivost do">
        <Input
          type="date"
          value={confidentialityUntil}
          onChange={(e) => setConfidentialityUntil(e.target.value)}
        />
      </Field>

      <Field label="Shrnutí">
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </Field>

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Zrušit
        </Button>
        <Button type="submit" disabled={saving}>
          Uložit
        </Button>
      </DialogFooter>
    </form>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
