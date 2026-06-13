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
import { clientApi } from "@/lib/store"
import { emptyAddress } from "@/lib/types"
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
  const [draft, setDraft] = React.useState<Draft>(() =>
    client ? structuredClone(client) : blankDraft()
  )
  const [loadingAres, setLoadingAres] = React.useState(false)

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const setAddr = (key: keyof Address, value: string) =>
    setDraft((d) => ({ ...d, address: { ...d.address, [key]: value } }))

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
        ico: data.ico || d.ico,
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

  function save() {
    if (!draft.name.trim()) {
      toast.error("Vyplňte název klienta.")
      return
    }
    if (client) {
      clientApi.patch(client._id, draft)
      toast.success("Klient uložen.")
    } else {
      clientApi.create(draft)
      toast.success("Klient přidán.")
    }
    onClose()
  }

  return (
    <div
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault()
          save()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{client ? "Upravit klienta" : "Nový klient"}</DialogTitle>
        <DialogDescription>
          Zadejte IČO a načtěte údaje z registru ARES.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>IČO</Label>
          <div className="flex gap-2">
            <Input
              value={draft.ico}
              onChange={(e) => setField("ico", e.target.value)}
              placeholder="12345678"
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              onClick={loadFromAres}
              disabled={loadingAres}
            >
              {loadingAres ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Download />
              )}
              ARES
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Název</Label>
          <Input
            value={draft.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Název firmy / jméno"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>DIČ</Label>
            <Input
              value={draft.dic}
              onChange={(e) => setField("dic", e.target.value)}
              placeholder="CZ12345678"
            />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="faktury@firma.cz"
            />
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
            />
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

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Zrušit
        </Button>
        <Button onClick={save}>Uložit</Button>
      </DialogFooter>
    </div>
  )
}
