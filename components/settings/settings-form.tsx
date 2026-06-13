"use client"

import * as React from "react"
import { Save, Download, Loader2, Check } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Kbd } from "@/components/kbd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { formatCzechPhone } from "@/lib/format"
import { useProfile, profileApi } from "@/lib/store"
import {
  companyProfileSchema,
  aresResultSchema,
  fieldErrors,
  firstError,
} from "@/lib/schemas"
import type { CompanyProfile } from "@/lib/types"

export function SettingsForm() {
  const profile = useProfile()
  const [draft, setDraft] = React.useState<CompanyProfile>(profile)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
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
  ) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => {
      if (!(key in e)) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  function save() {
    const result = companyProfileSchema.safeParse(draft)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      toast.error(firstError(result.error))
      return
    }
    setErrors({})
    profileApi.save(draft)
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
