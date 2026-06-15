"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, FileDown, ArrowLeft, Check } from "lucide-react"
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
import { Sensitive } from "@/components/ui/sensitive"
import { useHotkeys } from "@/hooks/use-hotkeys"
import {
  useClients,
  useProfile,
  useInvoice,
  useInvoices,
  useInvoiceApi,
} from "@/lib/store"
import { computeTotals, emptyItem, nextInvoiceNumber } from "@/lib/invoice"
import { invoiceDraftSchema, fieldErrors, firstError } from "@/lib/schemas"
import { formatCZK, formatDate } from "@/lib/format"
import { addDaysISO, todayISO, toLocalISODate } from "@/lib/format"
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
import { buildSpayd, czechAccountToIban } from "@/lib/spayd"
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
  const invoiceApi = useInvoiceApi()

  const [draft, setDraft] = React.useState<Invoice>(() =>
    existing ? structuredClone(existing) : createDraft(invoices, profile)
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  // Faktura z Convexu přichází asynchronně – jakmile dorazí, promítneme ji do
  // draftu. Ref drží id už načtené faktury, aby se nepřepisovaly úpravy uživatele.
  const loadedId = React.useRef<string | null>(null)
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
    setErrors({})
  }

  function updateItem(id: string, patch: Partial<InvoiceItem>) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }))
    setErrors({})
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

  function validate(): boolean {
    const result = invoiceDraftSchema.safeParse({
      clientId: draft.clientId,
      issueDate: draft.issueDate,
      items: draft.items,
    })
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      toast.error(firstError(result.error))
      return false
    }
    setErrors({})
    return true
  }

  async function persist(): Promise<Invoice> {
    const toSave = { ...draft, status: "sent" as InvoiceStatus }
    if (existing) {
      await invoiceApi.patch(existing._id, toSave)
      return toSave
    }
    const id = await invoiceApi.create(toSave)
    return { ...toSave, _id: id }
  }

  async function handleSave() {
    if (!validate()) return
    const saved = await persist()
    toast.success(`Faktura ${saved.number} uložena.`)
    router.push(routes.invoices)
  }

  async function handlePdf() {
    if (!validate()) return
    const saved = await persist()
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
            <Button variant="outline" onClick={handlePdf}>
              <FileDown />
              Export PDF
            </Button>
            <Button onClick={handleSave}>
              <Check />
              Uložit fakturu
            </Button>
          </>
        }
      />

      <div className="space-y-10">
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
                  {errors.clientId && (
                    <FieldError>{errors.clientId}</FieldError>
                  )}
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
                        className="select-non mt-2 flex cursor-pointer items-center gap-2.5"
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
                <Sensitive className="text-lg text-primary tabular-nums">
                  {formatCZK(totals.total)}
                </Sensitive>
              </div>
              {profile.bankAccount ? (
                <QrPreview
                  invoice={draft}
                  profile={profile}
                  total={totals.total}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Doplňte číslo účtu v nastavení pro QR Platbu na PDF.
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
            <span
              className={`${profile.vatPayer ? "col-span-4" : "col-span-5"} pl-2 text-xs tracking-wide text-muted-foreground uppercase`}
            >
              Popis
            </span>
            <span className="col-span-1 pl-2 text-xs tracking-wide text-muted-foreground uppercase">
              Počet
            </span>
            <span className="col-span-2 pl-2 text-xs tracking-wide text-muted-foreground uppercase">
              MJ
            </span>
            <span className="col-span-2 pl-2 text-xs tracking-wide text-muted-foreground uppercase">
              Cena/MJ
            </span>
            {profile.vatPayer && (
              <span className="col-span-2 pl-2 text-xs tracking-wide text-muted-foreground uppercase">
                DPH %
              </span>
            )}
            <div
              className={
                profile.vatPayer
                  ? "col-span-1 flex justify-end"
                  : "col-span-2 flex justify-end"
              }
            >
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus />
                Přidat
              </Button>
            </div>
          </div>
          <div className="divide-y">
            {draft.items.map((item, index) => (
              <div
                key={item.id}
                className="grid grid-cols-12 items-end gap-2 px-4 py-3"
              >
                <div
                  className={`col-span-12 ${profile.vatPayer ? "sm:col-span-4" : "sm:col-span-5"}`}
                >
                  <Label className="mb-1 text-xs text-muted-foreground sm:hidden">
                    Popis
                  </Label>
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(item.id, { description: e.target.value })
                    }
                    placeholder="Popis položky"
                    aria-invalid={
                      !!errors[`items.${index}.description`] || undefined
                    }
                  />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <Label className="mb-1 text-xs text-muted-foreground sm:hidden">
                    Počet
                  </Label>
                  <NumberInput
                    value={item.quantity}
                    onValueChange={(quantity) =>
                      updateItem(item.id, { quantity })
                    }
                    aria-invalid={
                      !!errors[`items.${index}.quantity`] || undefined
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
                    aria-invalid={!!errors[`items.${index}.unit`] || undefined}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label className="mb-1 text-xs text-muted-foreground sm:hidden">
                    Cena/MJ
                  </Label>
                  <Sensitive className="block">
                    <NumberInput
                      value={item.unitPrice}
                      onValueChange={(unitPrice) =>
                        updateItem(item.id, { unitPrice })
                      }
                      aria-invalid={
                        !!errors[`items.${index}.unitPrice`] || undefined
                      }
                    />
                  </Sensitive>
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
                      : "col-span-12 flex items-center justify-end gap-2 sm:col-span-2"
                  }
                >
                  <Sensitive className="text-sm tabular-nums">
                    {formatCZK(item.quantity * item.unitPrice)}
                  </Sensitive>
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

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-destructive">{children}</p>
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
              onChange(toLocalISODate(date))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function NumberInput({
  value,
  onValueChange,
  ...props
}: {
  value: number
  onValueChange: (value: number) => void
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type">) {
  // Drží vlastní textový stav, aby šlo pole vymazat (jinak `Number("")` → 0
  // a nešla by přepsat počáteční nula). Hodnotu zvenčí promítneme do textu jen
  // když se liší číselně – sync během renderu, ne v efektu.
  const [text, setText] = React.useState(() => String(value))
  const [prevValue, setPrevValue] = React.useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    if ((text === "" ? NaN : Number(text)) !== value) setText(String(value))
  }

  return (
    <Input
      type="number"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const n = raw === "" ? 0 : Number(raw)
        if (!Number.isNaN(n)) onValueChange(n)
      }}
      {...props}
    />
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
      <Sensitive className="tabular-nums">{value}</Sensitive>
    </div>
  )
}

function QrPreview({
  invoice,
  profile,
  total,
}: {
  invoice: Invoice
  profile: CompanyProfile
  total: number
}) {
  // Klíč popisuje vstupy QR kódu. Pokud nejsou platné, je null a QR se nezobrazí.
  const iban = czechAccountToIban(profile.bankAccount)
  const qrKey =
    iban && total > 0
      ? JSON.stringify({
          iban,
          name: profile.name,
          total,
          variableSymbol: invoice.variableSymbol,
          number: invoice.number,
          dueDate: invoice.dueDate,
        })
      : null

  const [qr, setQr] = React.useState<{ key: string; url: string } | null>(null)

  React.useEffect(() => {
    if (!qrKey || !iban) return
    let active = true
    const payload = buildSpayd({
      iban,
      amount: total,
      variableSymbol: invoice.variableSymbol,
      recipientName: profile.name,
      message: `Faktura ${invoice.number}`,
      dueDate: invoice.dueDate,
    })
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(payload, { margin: 1, width: 320 })
      )
      .then((url) => {
        if (active) setQr({ key: qrKey, url })
      })
      .catch(() => {
        if (active) setQr(null)
      })
    return () => {
      active = false
    }
  }, [
    qrKey,
    iban,
    profile.name,
    total,
    invoice.variableSymbol,
    invoice.number,
    invoice.dueDate,
  ])

  // Zobrazíme QR jen pokud odpovídá aktuálním vstupům (jinak je zastaralý).
  const dataUrl = qr && qr.key === qrKey ? qr.url : null
  if (!dataUrl) return null

  return (
    <div className="flex flex-col items-center gap-1.5 pt-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt="QR Platba"
        className="size-32 rounded bg-white p-1.5"
      />
      <span className="text-xs text-muted-foreground">QR Platba</span>
    </div>
  )
}
