"use client"

import * as React from "react"
import { Loader2, Download } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useClientApi } from "@/lib/store"
import { emptyAddress } from "@/lib/types"
import {
  clientDraftSchema,
  icoSchema,
  aresResultSchema,
  fieldErrors,
  firstError,
} from "@/lib/schemas"
import type { Client, Address } from "@/lib/types"

type Draft = Omit<Client, "_id" | "createdAt" | "updatedAt">

function blankDraft(): Draft {
  return {
    name: "",
    ico: "",
    dic: "",
    email: "",
    address: emptyAddress(),
  }
}

export function ClientDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Formulář se mountuje až při otevření → čerstvý stav bez efektů. */}
        {open && (
          <ClientForm client={client} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ClientForm({
  client,
  onClose,
}: {
  client?: Client
  onClose: () => void
}) {
  const clientApi = useClientApi()
  const [draft, setDraft] = React.useState<Draft>(() =>
    client ? structuredClone(client) : blankDraft()
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(false)

  const clearError = (key: string) =>
    setErrors((e) => {
      if (!(key in e)) return e
      const next = { ...e }
      delete next[key]
      return next
    })

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    clearError(key)
  }

  const setAddr = (key: keyof Address, value: string) => {
    setDraft((d) => ({ ...d, address: { ...d.address, [key]: value } }))
    clearError(`address.${key}`)
  }

  async function fetchFromAres(ico: string): Promise<Draft | null> {
    const res = await fetch(`/api/ares?ico=${ico}`)
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? "Načtení z ARES selhalo.")
      return null
    }
    const parsed = aresResultSchema.safeParse(json)
    if (!parsed.success) {
      toast.error("ARES vrátil neočekávaná data.")
      return null
    }
    const data = parsed.data
    return {
      name: data.name || "",
      ico: data.ico || ico,
      dic: data.dic || "",
      email: "",
      address: { ...emptyAddress(), ...data.address },
    }
  }

  async function save() {
    if (!client) {
      const result = icoSchema.safeParse(draft.ico)
      if (!result.success) {
        setErrors({ ico: firstError(result.error) })
        toast.error(firstError(result.error))
        return
      }
      setLoading(true)
      try {
        const fetched = await fetchFromAres(result.data.replace(/\s+/g, ""))
        if (!fetched) return
        await clientApi.create(fetched)
        toast.success("Klient přidán.")
        onClose()
      } catch {
        toast.error("Nepodařilo se spojit s ARES.")
      } finally {
        setLoading(false)
      }
      return
    }

    const result = clientDraftSchema.safeParse(draft)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      toast.error(firstError(result.error))
      return
    }
    setErrors({})
    await clientApi.patch(client._id, draft)
    toast.success("Klient uložen.")
    onClose()
  }

  async function loadFromAres() {
    const ico = draft.ico.replace(/\s+/g, "")
    if (!/^\d{8}$/.test(ico)) {
      setErrors((e) => ({ ...e, ico: "Zadejte platné IČO (8 číslic)." }))
      toast.error("Zadejte platné IČO (8 číslic).")
      return
    }
    setLoading(true)
    try {
      const fetched = await fetchFromAres(ico)
      if (!fetched) return
      setDraft((d) => ({ ...d, ...fetched }))
      toast.success("Údaje načteny z ARES.")
    } catch {
      toast.error("Nepodařilo se spojit s ARES.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault()
          save()
        }
      }}
      className="flex flex-col gap-6"
    >
      <DialogHeader>
        <DialogTitle>{client ? "Upravit klienta" : "Nový klient"}</DialogTitle>
        {!client && (
          <DialogDescription>
            Zadejte IČO a načtěte údaje z registru ARES.
          </DialogDescription>
        )}
      </DialogHeader>

      {!client ? (
        <div className="space-y-1.5">
          <Label>IČO</Label>
          <Input
            value={draft.ico}
            onChange={(e) => setField("ico", e.target.value)}
            placeholder="12345678"
            aria-invalid={!!errors.ico || undefined}
            autoFocus
          />
          {errors.ico && <FieldError>{errors.ico}</FieldError>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>IČO</Label>
            <div className="flex gap-2">
              <Input
                value={draft.ico}
                onChange={(e) => setField("ico", e.target.value)}
                placeholder="12345678"
                aria-invalid={!!errors.ico || undefined}
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                onClick={loadFromAres}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download />
                )}
                ARES
              </Button>
            </div>
            {errors.ico && <FieldError>{errors.ico}</FieldError>}
          </div>

          <div className="space-y-1.5">
            <Label>Název</Label>
            <Input
              value={draft.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Název firmy / jméno"
              aria-invalid={!!errors.name || undefined}
            />
            {errors.name && <FieldError>{errors.name}</FieldError>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>DIČ</Label>
              <Input
                value={draft.dic}
                onChange={(e) => setField("dic", e.target.value)}
                placeholder="CZ12345678"
                aria-invalid={!!errors.dic || undefined}
              />
              {errors.dic && <FieldError>{errors.dic}</FieldError>}
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="faktury@firma.cz"
                aria-invalid={!!errors.email || undefined}
              />
              {errors.email && <FieldError>{errors.email}</FieldError>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ulice a č.p.</Label>
            <Input
              value={draft.address.street}
              onChange={(e) => setAddr("street", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>PSČ</Label>
              <Input
                value={draft.address.zip}
                onChange={(e) => setAddr("zip", e.target.value)}
                aria-invalid={!!errors["address.zip"] || undefined}
              />
              {errors["address.zip"] && (
                <FieldError>{errors["address.zip"]}</FieldError>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Město</Label>
              <Input
                value={draft.address.city}
                onChange={(e) => setAddr("city", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Zrušit
        </Button>
        <Button onClick={save} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          Uložit
        </Button>
      </DialogFooter>
    </div>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-destructive">{children}</p>
}
