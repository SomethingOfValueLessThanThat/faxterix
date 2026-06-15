"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, FileDown, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/motion"
import { PageHeader } from "@/components/page-header"
import { PageContainer } from "@/components/page-container"
import { Kbd } from "@/components/kbd"
import { InvoiceTable } from "@/components/invoices/invoice-table"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useInvoices, useClients, useDataApi } from "@/lib/store"
import { parseFakturoidCsv } from "@/lib/import-csv"
import { routes } from "@/lib/routes"

export function InvoicesView() {
  const router = useRouter()
  const invoices = useInvoices()
  const clients = useClients()
  const dataApi = useDataApi()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const createInvoice = React.useCallback(
    () => router.push(routes.newInvoice),
    [router]
  )

  const handleImport = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = "" // umožní znovu vybrat stejný soubor
      if (!file) return

      try {
        const text = await file.text()
        const result = parseFakturoidCsv(text, { clients, invoices })

        if (result.clients.length === 0 && result.invoices.length === 0) {
          toast.info(
            result.skipped > 0
              ? "Vše už je naimportováno."
              : "V souboru nebyla nalezena žádná data."
          )
          return
        }

        await dataApi.importData(result.clients, result.invoices)
        toast.success(
          `Naimportováno ${result.invoices.length} ${pluralizeInvoices(
            result.invoices.length
          )} a ${result.clients.length} ${pluralizeClients(
            result.clients.length
          )}.`
        )
      } catch {
        toast.error("Soubor se nepodařilo načíst. Zkontrolujte formát CSV.")
      }
    },
    [clients, invoices, dataApi]
  )

  useHotkeys([{ key: "n", handler: createInvoice }], [createInvoice])

  return (
    <PageContainer>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImport}
      />
      <PageHeader
        title="Faktury"
        description={`${invoices.length} ${pluralizeInvoices(invoices.length)}`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload />
              Importovat CSV
            </Button>
            <Button onClick={createInvoice}>
              <Plus strokeWidth={2.8} />
              Nová faktura
            </Button>
          </>
        }
      />

      {invoices.length === 0 ? (
        <FadeIn className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <FileDown className="size-8 text-muted-foreground" />
          <h2 className="mt-4">Zatím žádné faktury</h2>
          <p className="mt-1 max-w-sm text-sm text-balance text-muted-foreground">
            Vytvořte první fakturu.
            <br />
            Stiskněte <Kbd>N</Kbd> nebo klikněte na tlačítko výše.
          </p>
          <Button onClick={createInvoice} className="mt-4">
            <Plus />
            Nová faktura
          </Button>
        </FadeIn>
      ) : (
        <InvoiceTable invoices={invoices} />
      )}
    </PageContainer>
  )
}

function pluralizeInvoices(n: number): string {
  if (n === 1) return "faktura"
  if (n >= 2 && n <= 4) return "faktury"
  return "faktur"
}

function pluralizeClients(n: number): string {
  if (n === 1) return "klient"
  if (n >= 2 && n <= 4) return "klienti"
  return "klientů"
}
