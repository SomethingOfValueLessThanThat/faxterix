"use client"

import * as React from "react"
import { Save, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Kbd } from "@/components/kbd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useProfile, profileApi } from "@/lib/store"
import type { CompanyProfile, Address } from "@/lib/types"

export function SettingsForm() {
  const profile = useProfile()
  const [draft, setDraft] = React.useState<CompanyProfile>(profile)
  const [loadingAres, setLoadingAres] = React.useState(false)

  // Seed the draft from the store once it has hydrated from localStorage.
  const synced = React.useRef(false)
  React.useEffect(() => {
    if (!synced.current) {
      setDraft(profile)
      synced.current = true
    }
  }, [profile])

  const setField = <K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K]
  ) => setDraft((d) => ({ ...d, [key]: value }))

  const setAddr = (key: keyof Address, value: string) =>
    setDraft((d) => ({ ...d, address: { ...d.address, [key]: value } }))

  function save() {
    profileApi.save(draft)
    toast.success("Nastavení uloženo.")
  }

  useHotkeys([{ key: "s", meta: true, allowInInput: true, handler: save }], [
    draft,
  ])

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

  return (
    <>
      <PageHeader
        title="Nastavení"
        description="Údaje vaší firmy a platební informace"
        actions={
          <Button onClick={save}>
            <Save />
            Uložit
            <Kbd className="ml-1 border-0 bg-primary-foreground/20 text-primary-foreground">
              ⌘S
            </Kbd>
          </Button>
        }
      />

      <div className="max-w-2xl space-y-6">
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="text-sm">Dodavatel</h2>
          <div className="space-y-1.5">
            <Label>IČO</Label>
            <div className="flex gap-2">
              <Input
                value={draft.ico}
                onChange={(e) => setField("ico", e.target.value)}
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
                onChange={(e) => setField("name", e.target.value)}
              />
            </SettingsField>
            <SettingsField label="DIČ">
              <Input
                value={draft.dic}
                onChange={(e) => setField("dic", e.target.value)}
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
                onChange={(e) => setField("email", e.target.value)}
              />
            </SettingsField>
            <SettingsField label="Telefon">
              <Input
                value={draft.phone}
                onChange={(e) => setField("phone", e.target.value)}
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
              onCheckedChange={(v) => setField("vatPayer", v)}
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
                onChange={(e) => setField("bankAccount", e.target.value)}
                placeholder="123456789/0100"
              />
            </SettingsField>
            <SettingsField label="IBAN">
              <Input
                value={draft.iban}
                onChange={(e) => setField("iban", e.target.value)}
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
                onChange={(e) => setField("dueDays", Number(e.target.value))}
              />
            </SettingsField>
            <SettingsField label="Formát čísla faktury">
              <Input
                value={draft.numberFormat}
                onChange={(e) => setField("numberFormat", e.target.value)}
                placeholder="{YYYY}{NNNN}"
              />
            </SettingsField>
          </div>
          <p className="text-xs text-muted-foreground">
            Tokeny: {"{YYYY}"} rok, {"{MM}"} měsíc, {"{NNNN}"} pořadové číslo
            (počet N určuje počet číslic).
          </p>
        </section>
      </div>
    </>
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
