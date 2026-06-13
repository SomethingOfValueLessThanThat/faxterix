"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, FileDown, Save, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useHotkeys } from "@/hooks/use-hotkeys"
import {
  useClients,
  useProfile,
  useInvoice,
  useInvoices,
  invoiceApi,
} from "@/lib/store"
import { computeTotals, emptyItem, nextInvoiceNumber } from "@/lib/invoice"
import { formatCZK, formatDate } from "@/lib/format"
import { addDaysISO, todayISO } from "@/lib/format"
import { routes } from "@/lib/routes"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { cs } from "date-fns/locale"
import { downloadInvoicePdf } from "@/lib/pdf/generate"
import type {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  Client,
  CompanyProfile,
} from "@/lib/types"

const VAT_RATES = [21, 12, 0]
const PAYMENT_METHODS = [
  { value: "Převodem", label: "Převodem" },
  { value: "Hotovostí", label: "Hotovostí" },
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

export function InvoiceEditor({ invoiceId }: { invoiceId?: string }) {
  const router = useRouter()
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
    const toSave = { ...draft, status: "sent" as InvoiceStatus }
    if (existing) {
      invoiceApi.patch(existing._id, toSave)
      return toSave
    }
    const id = invoiceApi.create(toSave)
    return { ...toSave, _id: id }
  }

  function handleSave() {
    const saved = persist()
    toast.success(`Faktura ${saved.number} uložena.`)
    // A freshly created invoice gets its own URL so a reload keeps editing it.
    if (!existing) router.replace(routes.invoice(saved._id))
  }

  async function handlePdf() {
    const saved = persist()
    try {
      await downloadInvoicePdf(saved, profile)
    } catch (err) {
      console.error(err)
      toast.error("Nepodařilo se vytvořit PDF.")
    }
    if (!existing) router.replace(routes.invoice(saved._id))
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
        title="Faktura"
        description={draft.number}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => router.push(routes.invoices)}
            >
              <ArrowLeft />
              Zpět
            </Button>
            <Button variant="secondary" onClick={handlePdf}>
              <FileDown />
              Export PDF
            </Button>
            <Button onClick={handleSave}>
              <Save />
              Uložit fakturu
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            {/* Hlavička */}
            <section className="space-y-4 rounded-lg" style={{ maxWidth: 504 }}>
              <div>
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
              <div className="grid gap-4">
                <Field label="Datum vystavení">
                  <DatePicker
                    value={draft.issueDate}
                    onChange={(iso) => set("issueDate", iso)}
                  />
                </Field>
                <Field label="Způsob platby">
                  <div className="flex gap-6">
                    {PAYMENT_METHODS.map((o) => (
                      <label
                        key={o.value}
                        className="flex items-center gap-2.5 cursor-pointer select-none"
                      >
                        <Checkbox
                          checked={draft.paymentMethod === o.value}
                          onCheckedChange={() => set("paymentMethod", o.value)}
                        />
                        <span className="text-sm">{o.label}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
            </section>
          </div>

          {/* Souhrn */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="space-y-3 rounded-lg border p-4">
              <h2 className="text-sm">Souhrn</h2>
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
                <span>K úhradě</span>
                <span className="text-lg text-primary tabular-nums">
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

        {/* Položky */}
        <section className="rounded-lg border">
          <div className="flex items-center justify-end border-b bg-muted/50 px-4 py-2.5 sm:hidden">
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus />
              Přidat
            </Button>
          </div>
          <div className="hidden border-b bg-muted/50 sm:grid sm:grid-cols-12 sm:items-center sm:gap-2 sm:px-4 sm:py-2.5">
            <span className="col-span-3 text-xs tracking-wide text-muted-foreground uppercase">Popis</span>
            <span className="col-span-2 text-xs tracking-wide text-muted-foreground uppercase">Počet</span>
            <span className="col-span-2 text-xs tracking-wide text-muted-foreground uppercase">MJ</span>
            <span className="col-span-2 text-xs tracking-wide text-muted-foreground uppercase">Cena/MJ</span>
            {profile.vatPayer && <span className="col-span-2 text-xs tracking-wide text-muted-foreground uppercase">DPH %</span>}
            <div className={profile.vatPayer ? "col-span-1 flex justify-end" : "col-span-3 flex justify-end"}>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus />
                Přidat
              </Button>
            </div>
          </div>
          <div className="divide-y">
            {draft.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 items-end gap-2 px-4 py-3"
              >
                <div className="col-span-12 sm:col-span-3">
                  <Label className="mb-1 text-xs text-muted-foreground sm:hidden">
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
                <div className="col-span-4 sm:col-span-2">
                  <Label className="mb-1 text-xs text-muted-foreground sm:hidden">
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
                <div className="col-span-4 sm:col-span-2">
                  <Label className="mb-1 text-xs text-muted-foreground sm:hidden">
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
                  <Label className="mb-1 text-xs text-muted-foreground sm:hidden">
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
                    <Label className="mb-1 text-xs text-muted-foreground sm:hidden">
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
                  <span className="text-sm tabular-nums">
                    {formatCZK(item.quantity * item.unitPrice)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeItem(item.id)}
                    aria-label="Odebrat položku"
                  >
                    <Trash2 className="text-destructive" />
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

function DatePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (iso: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? new Date(value + "T12:00:00") : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="w-full justify-start">
            <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
            {value ? (
              formatDate(value)
            ) : (
              <span className="text-muted-foreground">Vyberte datum</span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          locale={cs}
          onSelect={(date) => {
            if (date) {
              const iso = date.toISOString().slice(0, 10)
              onChange(iso)
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
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
