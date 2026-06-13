"use client"

import * as React from "react"
import { Plus, Trash2, FileDown, Save, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Kbd } from "@/components/kbd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useHotkeys } from "@/hooks/use-hotkeys"
import {
  useClients,
  useProfile,
  useInvoice,
  useInvoices,
  invoiceApi,
} from "@/lib/store"
import { computeTotals, emptyItem, nextInvoiceNumber } from "@/lib/invoice"
import { formatCZK } from "@/lib/format"
import { addDaysISO, todayISO } from "@/lib/format"
import { downloadInvoicePdf } from "@/lib/pdf/generate"
import type {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  Client,
  CompanyProfile,
} from "@/lib/types"

const VAT_RATES = [21, 12, 0]
const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "draft", label: "Koncept" },
  { value: "sent", label: "Odesláno" },
  { value: "paid", label: "Zaplaceno" },
]

function snapshotOf(client: Client | undefined) {
  if (!client) return null
  return {
    name: client.name,
    ico: client.ico,
    dic: client.dic,
    email: client.email,
    address: client.address,
  }
}

export function InvoiceEditor({
  invoiceId,
  onBack,
  onSaved,
}: {
  invoiceId?: string
  onBack: () => void
  onSaved?: (id: string) => void
}) {
  const clients = useClients()
  const profile = useProfile()
  const invoices = useInvoices()
  const existing = useInvoice(invoiceId)

  const [draft, setDraft] = React.useState<Invoice>(() =>
    existing ? structuredClone(existing) : createDraft(invoices, profile)
  )
  // Pokud se existující faktura načte později (hydratace), promítneme ji.
  const loadedId = React.useRef(invoiceId)
  React.useEffect(() => {
    if (existing && loadedId.current !== existing._id) {
      setDraft(structuredClone(existing))
      loadedId.current = existing._id
    }
  }, [existing])

  const totals = React.useMemo(
    () => computeTotals(draft.items, profile.vatPayer),
    [draft.items, profile.vatPayer]
  )

  const set = React.useCallback(
    <K extends keyof Invoice>(key: K, value: Invoice[K]) =>
      setDraft((d) => ({ ...d, [key]: value })),
    []
  )

  function selectClient(clientId: string) {
    const client = clients.find((c) => c._id === clientId)
    setDraft((d) => ({
      ...d,
      clientId: clientId || null,
      client: snapshotOf(client),
    }))
  }

  function updateItem(id: string, patch: Partial<InvoiceItem>) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }))
  }

  function addItem() {
    setDraft((d) => ({ ...d, items: [...d.items, emptyItem()] }))
  }

  function removeItem(id: string) {
    setDraft((d) => ({
      ...d,
      items: d.items.filter((it) => it.id !== id),
    }))
  }

  function persist(): Invoice {
    if (existing) {
      invoiceApi.patch(existing._id, draft)
      return draft
    }
    const id = invoiceApi.create(draft)
    return { ...draft, _id: id }
  }

  function handleSave() {
    const saved = persist()
    toast.success(`Faktura ${saved.number} uložena.`)
    if (!existing) onSaved?.(saved._id)
  }

  async function handlePdf() {
    const saved = persist()
    try {
      await downloadInvoicePdf(saved, profile)
    } catch (err) {
      console.error(err)
      toast.error("Nepodařilo se vytvořit PDF.")
    }
    if (!existing) onSaved?.(saved._id)
  }

  useHotkeys(
    [
      {
        key: "s",
        meta: true,
        allowInInput: true,
        handler: handleSave,
      },
    ],
    [draft, existing]
  )

  return (
    <>
      <PageHeader
        title={existing ? `Faktura ${existing.number}` : "Nová faktura"}
        actions={
          <>
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft />
              Zpět
            </Button>
            <Button variant="outline" onClick={handlePdf}>
              <FileDown />
              PDF
            </Button>
            <Button onClick={handleSave}>
              <Save />
              Uložit
              <Kbd className="ml-1 border-0 bg-primary-foreground/20 text-primary-foreground">
                ⌘S
              </Kbd>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          {/* Hlavička */}
          <section className="space-y-4 rounded-lg border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Číslo faktury">
                <Input
                  value={draft.number}
                  onChange={(e) => set("number", e.target.value)}
                />
              </Field>
              <Field label="Klient">
                <Select
                  value={draft.clientId ?? ""}
                  onValueChange={(v) => selectClient(String(v ?? ""))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Vyberte klienta">
                      {(id: string | null) =>
                        id
                          ? (clients.find((c) => c._id === id)?.name ?? "")
                          : "Vyberte klienta"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 ? (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        Žádní klienti
                      </div>
                    ) : (
                      clients.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Datum vystavení">
                <Input
                  type="date"
                  value={draft.issueDate}
                  onChange={(e) => set("issueDate", e.target.value)}
                />
              </Field>
              <Field label="Splatnost">
                <Input
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => set("dueDate", e.target.value)}
                />
              </Field>
              <Field label="DUZP">
                <Input
                  type="date"
                  value={draft.taxDate}
                  onChange={(e) => set("taxDate", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Variabilní symbol">
                <Input
                  value={draft.variableSymbol}
                  onChange={(e) => set("variableSymbol", e.target.value)}
                />
              </Field>
              <Field label="Způsob platby">
                <Input
                  value={draft.paymentMethod}
                  onChange={(e) => set("paymentMethod", e.target.value)}
                  placeholder="Převodem"
                />
              </Field>
              <Field label="Stav">
                <Select
                  value={draft.status}
                  onValueChange={(v) => set("status", v as InvoiceStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          {/* Položky */}
          <section className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-medium">Položky</h2>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus />
                Přidat
              </Button>
            </div>
            <div className="divide-y">
              {draft.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 items-end gap-2 px-4 py-3"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <Label className="mb-1 text-xs text-muted-foreground">
                      Popis
                    </Label>
                    <Input
                      value={item.description}
                      onChange={(e) =>
                        updateItem(item.id, { description: e.target.value })
                      }
                      placeholder="Popis položky"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-1">
                    <Label className="mb-1 text-xs text-muted-foreground">
                      Počet
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, {
                          quantity: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-1">
                    <Label className="mb-1 text-xs text-muted-foreground">
                      MJ
                    </Label>
                    <Input
                      value={item.unit}
                      onChange={(e) =>
                        updateItem(item.id, { unit: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="mb-1 text-xs text-muted-foreground">
                      Cena/MJ
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(item.id, {
                          unitPrice: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  {profile.vatPayer && (
                    <div className="col-span-6 sm:col-span-2">
                      <Label className="mb-1 text-xs text-muted-foreground">
                        DPH %
                      </Label>
                      <Select
                        value={String(item.vatRate)}
                        onValueChange={(v) =>
                          updateItem(item.id, { vatRate: Number(v) })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VAT_RATES.map((r) => (
                            <SelectItem key={r} value={String(r)}>
                              {r} %
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div
                    className={
                      profile.vatPayer
                        ? "col-span-6 flex items-center justify-end gap-2 sm:col-span-1"
                        : "col-span-12 flex items-center justify-end gap-2 sm:col-span-3"
                    }
                  >
                    <span className="text-sm font-medium tabular-nums">
                      {formatCZK(item.quantity * item.unitPrice)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeItem(item.id)}
                      aria-label="Odebrat položku"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
              {draft.items.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Zatím žádné položky.
                </p>
              )}
            </div>
          </section>

          {/* Poznámka */}
          <section className="space-y-2 rounded-lg border p-4">
            <Label htmlFor="note">Poznámka</Label>
            <Textarea
              id="note"
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Volitelná poznámka na faktuře…"
            />
          </section>
        </div>

        {/* Souhrn */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-3 rounded-lg border p-4">
            <h2 className="text-sm font-medium">Souhrn</h2>
            <Separator />
            {profile.vatPayer && (
              <>
                <Row label="Základ" value={formatCZK(totals.subtotal)} />
                {totals.vatRows.map((r) => (
                  <Row
                    key={r.rate}
                    label={`DPH ${r.rate} %`}
                    value={formatCZK(r.vat)}
                    muted
                  />
                ))}
                <Separator />
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="font-medium">K úhradě</span>
              <span className="text-lg font-semibold text-primary tabular-nums">
                {formatCZK(totals.total)}
              </span>
            </div>
            {!profile.iban && (
              <p className="text-xs text-muted-foreground">
                Doplňte IBAN v nastavení pro QR Platbu na PDF.
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}

function createDraft(invoices: Invoice[], profile: CompanyProfile): Invoice {
  const issueDate = todayISO()
  const number = nextInvoiceNumber(invoices, profile)
  return {
    _id: "",
    number,
    clientId: null,
    client: null,
    issueDate,
    dueDate: addDaysISO(issueDate, profile.dueDays || 14),
    taxDate: issueDate,
    items: [emptyItem(profile.vatPayer ? 21 : 0)],
    status: "draft",
    note: "",
    variableSymbol: number.replace(/\D/g, ""),
    paymentMethod: "Převodem",
    createdAt: 0,
    updatedAt: 0,
  }
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div
      className={
        "flex items-center justify-between text-sm" +
        (muted ? " text-muted-foreground" : "")
      }
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
