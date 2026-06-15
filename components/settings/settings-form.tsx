"use client"

import * as React from "react"
import { Download, Loader2, Check } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { formatCzechPhone } from "@/lib/format"
import { useProfile, useProfileApi } from "@/lib/store"
import {
  companyProfileSchema,
  aresResultSchema,
  fieldErrors,
  firstError,
} from "@/lib/schemas"
import type { CompanyProfile } from "@/lib/types"

const BAND_LIMITS = [1_000_000, 1_500_000, 2_000_000]

export function SettingsForm() {
  const profile = useProfile()
  const profileApi = useProfileApi()
  const [draft, setDraft] = React.useState<CompanyProfile>(profile)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [loadingAres, setLoadingAres] = React.useState(false)

  // Profil přichází z Convexu asynchronně. Dokud uživatel formulář neupravil,
  // sejmeme do draftu poslední načtený profil; po první editaci ho nepřepisujeme.
  // Synchronizace probíhá během renderu (ne v efektu), aby nedocházelo
  // ke kaskádovým renderům.
  const [dirty, setDirty] = React.useState(false)
  const [syncedProfile, setSyncedProfile] = React.useState(profile)
  if (!dirty && profile !== syncedProfile) {
    setSyncedProfile(profile)
    setDraft(profile)
  }

  const setField = <K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K]
  ) => {
    setDirty(true)
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => {
      if (!(key in e)) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  async function save() {
    const result = companyProfileSchema.safeParse(draft)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      toast.error(firstError(result.error))
      return
    }
    setErrors({})
    await profileApi.save(draft)
    setDirty(false)
    toast.success("Nastavení uloženo.")
  }

  useHotkeys(
    [{ key: "s", meta: true, allowInInput: true, handler: save }],
    [draft]
  )

  async function loadFromAres() {
    const ico = draft.ico.replace(/\s+/g, "")
    if (!/^\d{8}$/.test(ico)) {
      setErrors((e) => ({ ...e, ico: "Zadejte platné IČO (8 číslic)." }))
      toast.error("Zadejte platné IČO (8 číslic).")
      return
    }
    setLoadingAres(true)
    try {
      const res = await fetch(`/api/ares?ico=${ico}`)
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Načtení z ARES selhalo.")
        return
      }
      const parsed = aresResultSchema.safeParse(json)
      if (!parsed.success) {
        toast.error("ARES vrátil neočekávaná data.")
        return
      }
      const data = parsed.data
      setDirty(true)
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
            <Check />
            Uložit
          </Button>
        }
      />

      <div className="max-w-[504px] space-y-6">
        <section className="space-y-4">
          <h2 className="text-sm">Dodavatel</h2>
          <div className="space-y-1.5">
            <Label>IČO</Label>
            <div className="flex gap-2">
              <Input
                value={draft.ico}
                onChange={(e) => setField("ico", e.target.value)}
                placeholder="12345678"
                aria-invalid={!!errors.ico || undefined}
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
            {errors.ico && <FieldError>{errors.ico}</FieldError>}
          </div>
          <SettingsField label="E-mail" error={errors.email}>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => setField("email", e.target.value)}
              aria-invalid={!!errors.email || undefined}
            />
          </SettingsField>
          <SettingsField label="Telefon" error={errors.phone}>
            <Input
              type="tel"
              inputMode="tel"
              value={draft.phone}
              onChange={(e) =>
                setField("phone", formatCzechPhone(e.target.value))
              }
              placeholder="+420 123 456 789"
              aria-invalid={!!errors.phone || undefined}
            />
          </SettingsField>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm">Platební údaje</h2>
            <p className="text-xs text-muted-foreground">
              IBAN je potřeba pro vygenerování QR Platby na PDF.
            </p>
          </div>
          <SettingsField label="Číslo účtu" error={errors.bankAccount}>
            <Input
              value={draft.bankAccount}
              onChange={(e) => setField("bankAccount", e.target.value)}
              placeholder="123456789/0100"
              aria-invalid={!!errors.bankAccount || undefined}
            />
          </SettingsField>
          <SettingsField label="IBAN" error={errors.iban}>
            <Input
              value={draft.iban}
              onChange={(e) => setField("iban", e.target.value)}
              placeholder="CZ65 0800 0000 1920 0014 5399"
              aria-invalid={!!errors.iban || undefined}
            />
          </SettingsField>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm">Fakturace</h2>
          <SettingsField label="Splatnost (dní)" error={errors.dueDays}>
            <Input
              type="number"
              value={draft.dueDays}
              onChange={(e) => setField("dueDays", Number(e.target.value))}
              aria-invalid={!!errors.dueDays || undefined}
            />
          </SettingsField>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm">Paušální daň</h2>
          <SettingsField label="Pásmo paušální daně">
            <Select
              value={String(draft.selectedBand)}
              onValueChange={(v) => {
                const band = Number(v) as 1 | 2 | 3
                setField("selectedBand", band)
                setField("bandLimits", BAND_LIMITS)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1. pásmo — do 1 000 000 Kč</SelectItem>
                <SelectItem value="2">2. pásmo — do 1 500 000 Kč</SelectItem>
                <SelectItem value="3">3. pásmo — do 2 000 000 Kč</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField label="Měsíční platba paušální daně (Kč)">
            <Input
              type="number"
              min={0}
              value={draft.flatTaxMonthly}
              onChange={(e) => setField("flatTaxMonthly", Number(e.target.value))}
            />
          </SettingsField>
        </section>

        {dirty && (
          <span className="inline-block rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
            Neuložené změny
          </span>
        )}
      </div>
    </>
  )
}

function SettingsField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-destructive">{children}</p>
}
