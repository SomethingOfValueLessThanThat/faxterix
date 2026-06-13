"use client"

import * as React from "react"
import {
  Plus,
  FileDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Save,
  Download,
  Loader2,
  Mail,
  FileText,
  Settings,
  Command as CommandIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ClientDialog } from "@/components/client-dialog"
import { InvoiceEditor } from "@/components/invoice-editor"
import { CommandMenu } from "@/components/command-menu"
import { Kbd } from "@/components/kbd"
import { useHotkeys } from "@/hooks/use-hotkeys"
import {
  useInvoices,
  useClients,
  useProfile,
  invoiceApi,
  clientApi,
  profileApi,
} from "@/lib/store"
import { computeTotals } from "@/lib/invoice"
import { formatCZK, formatDate } from "@/lib/format"
import { downloadInvoicePdf } from "@/lib/pdf/generate"
import { AppNavContext, type AppTab, type NavAction } from "@/lib/app-nav"
import type {
  InvoiceStatus,
  Client,
  CompanyProfile,
  Address,
} from "@/lib/types"

const statusMeta: Record<
  InvoiceStatus,
  {
    label: string
    variant:
      | "secondary"
      | "default"
      | "outline"
      | "success"
      | "warning"
      | "info"
  }
> = {
  draft: { label: "Koncept", variant: "outline" },
  sent: { label: "Odesláno", variant: "info" },
  paid: { label: "Zaplaceno", variant: "success" },
}

// editor state: null = list, "nova" = new, string = edit by id
type EditorState = null | "nova" | string

export default function Home() {
  const [activeTab, setActiveTab] = React.useState<AppTab>("faktury")

  // Faktury
  const invoices = useInvoices()
  const profile = useProfile()
  const [editorState, setEditorState] = React.useState<EditorState>(null)

  // Klienti
  const clients = useClients()
  const [clientDialogOpen, setClientDialogOpen] = React.useState(false)
  const [editingClient, setEditingClient] = React.useState<Client | undefined>()

  // Nastavení
  const [draft, setDraft] = React.useState<CompanyProfile>(profile)
  const [loadingAres, setLoadingAres] = React.useState(false)
  const synced = React.useRef(false)
  React.useEffect(() => {
    if (!synced.current) {
      setDraft(profile)
      synced.current = true
    }
  }, [profile])

  const navigate = React.useCallback((action: NavAction) => {
    if (action.type === "tab") {
      setActiveTab(action.tab)
      setEditorState(null)
    } else if (action.type === "new-invoice") {
      setActiveTab("faktury")
      setEditorState("nova")
    } else if (action.type === "edit-invoice") {
      setActiveTab("faktury")
      setEditorState(action.id)
    } else if (action.type === "new-client") {
      setActiveTab("klienti")
      setClientDialogOpen(true)
      setEditingClient(undefined)
    }
  }, [])

  // Klávesové zkratky pro přepínání záložek
  useHotkeys(
    [
      {
        key: "1",
        meta: true,
        handler: () => navigate({ type: "tab", tab: "faktury" }),
      },
      {
        key: "2",
        meta: true,
        handler: () => navigate({ type: "tab", tab: "klienti" }),
      },
      {
        key: "3",
        meta: true,
        handler: () => navigate({ type: "tab", tab: "nastaveni" }),
      },
    ],
    [navigate]
  )

  // ⌘S pro uložení nastavení
  const setProfileField = <K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K]
  ) => setDraft((d) => ({ ...d, [key]: value }))
  const setAddr = (key: keyof Address, value: string) =>
    setDraft((d) => ({ ...d, address: { ...d.address, [key]: value } }))

  function saveProfile() {
    profileApi.save(draft)
    toast.success("Nastavení uloženo.")
  }

  useHotkeys(
    [{ key: "s", meta: true, allowInInput: true, handler: saveProfile }],
    [draft]
  )

  // Rychlá klávesa N pro faktury / klienty
  useHotkeys(
    [
      {
        key: "n",
        handler: () => {
          if (activeTab === "faktury") setEditorState("nova")
          else if (activeTab === "klienti") {
            setEditingClient(undefined)
            setClientDialogOpen(true)
          }
        },
      },
    ],
    [activeTab]
  )

  async function loadFromAres() {
    const ico = draft.ico.replace(/\s+/g, "")
    if (!/^\d{8}$/.test(ico)) {
      toast.error("Zadejte platné IČO (8 číslic).")
      return
    }
    setLoadingAres(true)
    try {
      const res = await fetch(`/api/ares?ico=${ico}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Načtení z ARES selhalo.")
        return
      }
      setDraft((d) => ({
        ...d,
        name: data.name || d.name,
        dic: data.dic || d.dic,
        address: { ...d.address, ...data.address },
      }))
      toast.success("Údaje načteny z ARES.")
    } catch {
      toast.error("Nepodařilo se spojit s ARES.")
    } finally {
      setLoadingAres(false)
    }
  }

  async function handleInvoicePdf(id: string) {
    const invoice = invoices.find((i) => i._id === id)
    if (!invoice) return
    try {
      await downloadInvoicePdf(invoice, profile)
    } catch (err) {
      console.error(err)
      toast.error("Nepodařilo se vytvořit PDF.")
    }
  }

  function handleInvoiceDelete(id: string, number: string) {
    invoiceApi.remove(id)
    toast.success(`Faktura ${number} smazána.`)
  }

  return (
    <AppNavContext.Provider value={{ navigate }}>
      <div className="flex min-h-svh items-start justify-center p-8 pt-12">
        <div className="w-full max-w-5xl overflow-hidden">
          <div className="px-8 pb-8">
            {/* Záložky */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v as AppTab)
                setEditorState(null)
              }}
            >
              <TabsList>
                <TabsTrigger value="faktury">
                  <FileText className="size-4" />
                  Faktury
                </TabsTrigger>
                <TabsTrigger value="klienti">
                  <Users className="size-4" />
                  Klienti
                </TabsTrigger>
                <TabsTrigger value="nastaveni">
                  <Settings className="size-4" />
                  Nastavení
                </TabsTrigger>
              </TabsList>

              {/* ── FAKTURY ── */}
              <TabsContent value="faktury">
                {editorState !== null ? (
                  <InvoiceEditor
                    invoiceId={editorState === "nova" ? undefined : editorState}
                    onBack={() => setEditorState(null)}
                    onSaved={(id) => setEditorState(id)}
                  />
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h1 className="text-xl tracking-tight">Faktury</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {invoices.length} {pluralFaktur(invoices.length)}
                        </p>
                      </div>
                      <Button
                        onClick={() => setEditorState("nova")}
                        className="rounded-full"
                      >
                        <Plus />
                        Nová faktura
                        <Kbd className="ml-1 border-0 bg-primary-foreground/20 text-primary-foreground">
                          N
                        </Kbd>
                      </Button>
                    </div>

                    {invoices.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
                        <FileDown className="size-8 text-muted-foreground" />
                        <h2 className="mt-4">Zatím žádné faktury</h2>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                          Vytvořte první fakturu. Stiskněte <Kbd>N</Kbd> nebo
                          klikněte na tlačítko výše.
                        </p>
                        <Button
                          onClick={() => setEditorState("nova")}
                          className="mt-4 rounded-full"
                        >
                          <Plus />
                          Nová faktura
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Číslo</TableHead>
                              <TableHead>Klient</TableHead>
                              <TableHead>Vystaveno</TableHead>
                              <TableHead>Splatnost</TableHead>
                              <TableHead>Stav</TableHead>
                              <TableHead className="text-right">
                                Částka
                              </TableHead>
                              <TableHead className="w-10" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoices.map((inv) => {
                              const total = computeTotals(
                                inv.items,
                                profile.vatPayer
                              ).total
                              const meta = statusMeta[inv.status]
                              return (
                                <TableRow
                                  key={inv._id}
                                  className="cursor-pointer"
                                  onClick={() => setEditorState(inv._id)}
                                >
                                  <TableCell className="">
                                    {inv.number}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {inv.client?.name ?? "—"}
                                  </TableCell>
                                  <TableCell>
                                    {formatDate(inv.issueDate)}
                                  </TableCell>
                                  <TableCell>
                                    {formatDate(inv.dueDate)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={meta.variant}>
                                      {meta.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCZK(total)}
                                  </TableCell>
                                  <TableCell
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <DropdownMenu>
                                      <DropdownMenuTrigger
                                        render={
                                          <Button
                                            variant="ghost"
                                            size="icon-sm"
                                          >
                                            <MoreHorizontal />
                                          </Button>
                                        }
                                      />
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() =>
                                            setEditorState(inv._id)
                                          }
                                        >
                                          <Pencil />
                                          Upravit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleInvoicePdf(inv._id)
                                          }
                                        >
                                          <FileDown />
                                          Stáhnout PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          variant="destructive"
                                          onClick={() =>
                                            handleInvoiceDelete(
                                              inv._id,
                                              inv.number
                                            )
                                          }
                                        >
                                          <Trash2 />
                                          Smazat
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ── KLIENTI ── */}
              <TabsContent value="klienti">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h1 className="text-xl tracking-tight">Klienti</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {clients.length} v adresáři
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingClient(undefined)
                      setClientDialogOpen(true)
                    }}
                    className="rounded-full"
                  >
                    <Plus />
                    Nový klient
                    <Kbd className="ml-1 border-0 bg-primary-foreground/20 text-primary-foreground">
                      N
                    </Kbd>
                  </Button>
                </div>

                {clients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
                    <Users className="size-8 text-muted-foreground" />
                    <h2 className="mt-4">Adresář je prázdný</h2>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Přidejte klienta a načtěte jeho údaje z ARES podle IČO.
                    </p>
                    <Button
                      onClick={() => {
                        setEditingClient(undefined)
                        setClientDialogOpen(true)
                      }}
                      className="mt-4 rounded-full"
                    >
                      <Plus />
                      Nový klient
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {clients.map((client) => (
                      <div
                        key={client._id}
                        className="group flex flex-col rounded-lg border p-4 transition-colors hover:border-foreground/20"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate">{client.name}</h3>
                            {client.ico ? (
                              <p className="text-xs text-muted-foreground">
                                IČO {client.ico}
                                {client.dic ? ` · DIČ ${client.dic}` : ""}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setEditingClient(client)
                                setClientDialogOpen(true)
                              }}
                              aria-label="Upravit"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                clientApi.remove(client._id)
                                toast.success(`Klient ${client.name} smazán.`)
                              }}
                              aria-label="Smazat"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 space-y-0.5 text-sm text-muted-foreground">
                          {client.address.street ? (
                            <p>{client.address.street}</p>
                          ) : null}
                          {client.address.zip || client.address.city ? (
                            <p>
                              {[client.address.zip, client.address.city]
                                .filter(Boolean)
                                .join(" ")}
                            </p>
                          ) : null}
                          {client.email ? (
                            <p className="flex items-center gap-1.5 pt-1">
                              <Mail className="size-3.5" />
                              {client.email}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <ClientDialog
                  open={clientDialogOpen}
                  onOpenChange={setClientDialogOpen}
                  client={editingClient}
                />
              </TabsContent>

              {/* ── NASTAVENÍ ── */}
              <TabsContent value="nastaveni">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h1 className="text-xl tracking-tight">Nastavení</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Údaje vaší firmy a platební informace
                    </p>
                  </div>
                  <Button onClick={saveProfile} className="rounded-full">
                    <Save />
                    Uložit
                    <Kbd className="ml-1 border-0 bg-primary-foreground/20 text-primary-foreground">
                      ⌘S
                    </Kbd>
                  </Button>
                </div>

                <div className="max-w-2xl space-y-6">
                  <section className="space-y-4 rounded-lg border p-4">
                    <h2 className="text-sm">Dodavatel</h2>
                    <div className="space-y-1.5">
                      <Label>IČO</Label>
                      <div className="flex gap-2">
                        <Input
                          value={draft.ico}
                          onChange={(e) =>
                            setProfileField("ico", e.target.value)
                          }
                          placeholder="12345678"
                        />
                        <Button
                          variant="outline"
                          onClick={loadFromAres}
                          disabled={loadingAres}
                        >
                          {loadingAres ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Download />
                          )}
                          Načíst z ARES
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingsField label="Název / jméno">
                        <Input
                          value={draft.name}
                          onChange={(e) =>
                            setProfileField("name", e.target.value)
                          }
                        />
                      </SettingsField>
                      <SettingsField label="DIČ">
                        <Input
                          value={draft.dic}
                          onChange={(e) =>
                            setProfileField("dic", e.target.value)
                          }
                        />
                      </SettingsField>
                    </div>
                    <SettingsField label="Ulice a č.p.">
                      <Input
                        value={draft.address.street}
                        onChange={(e) => setAddr("street", e.target.value)}
                      />
                    </SettingsField>
                    <div className="grid grid-cols-[120px_1fr] gap-4">
                      <SettingsField label="PSČ">
                        <Input
                          value={draft.address.zip}
                          onChange={(e) => setAddr("zip", e.target.value)}
                        />
                      </SettingsField>
                      <SettingsField label="Město">
                        <Input
                          value={draft.address.city}
                          onChange={(e) => setAddr("city", e.target.value)}
                        />
                      </SettingsField>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingsField label="E-mail">
                        <Input
                          type="email"
                          value={draft.email}
                          onChange={(e) =>
                            setProfileField("email", e.target.value)
                          }
                        />
                      </SettingsField>
                      <SettingsField label="Telefon">
                        <Input
                          value={draft.phone}
                          onChange={(e) =>
                            setProfileField("phone", e.target.value)
                          }
                        />
                      </SettingsField>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Plátce DPH</Label>
                        <p className="text-xs text-muted-foreground">
                          Na fakturách se bude počítat a zobrazovat DPH.
                        </p>
                      </div>
                      <Switch
                        checked={draft.vatPayer}
                        onCheckedChange={(v) => setProfileField("vatPayer", v)}
                      />
                    </div>
                  </section>

                  <section className="space-y-4 rounded-lg border p-4">
                    <div>
                      <h2 className="text-sm">Platební údaje</h2>
                      <p className="text-xs text-muted-foreground">
                        IBAN je potřeba pro vygenerování QR Platby na PDF.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingsField label="Číslo účtu">
                        <Input
                          value={draft.bankAccount}
                          onChange={(e) =>
                            setProfileField("bankAccount", e.target.value)
                          }
                          placeholder="123456789/0100"
                        />
                      </SettingsField>
                      <SettingsField label="IBAN">
                        <Input
                          value={draft.iban}
                          onChange={(e) =>
                            setProfileField("iban", e.target.value)
                          }
                          placeholder="CZ65 0800 0000 1920 0014 5399"
                        />
                      </SettingsField>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-lg border p-4">
                    <h2 className="text-sm">Fakturace</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingsField label="Splatnost (dní)">
                        <Input
                          type="number"
                          value={draft.dueDays}
                          onChange={(e) =>
                            setProfileField("dueDays", Number(e.target.value))
                          }
                        />
                      </SettingsField>
                      <SettingsField label="Formát čísla faktury">
                        <Input
                          value={draft.numberFormat}
                          onChange={(e) =>
                            setProfileField("numberFormat", e.target.value)
                          }
                          placeholder="{YYYY}{NNNN}"
                        />
                      </SettingsField>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tokeny: {"{YYYY}"} rok, {"{MM}"} měsíc, {"{NNNN}"}{" "}
                      pořadové číslo (počet N určuje počet číslic).
                    </p>
                  </section>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <CommandMenu />
    </AppNavContext.Provider>
  )
}

function SettingsField({
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

function pluralFaktur(n: number): string {
  if (n === 1) return "faktura"
  if (n >= 2 && n <= 4) return "faktury"
  return "faktur"
}
