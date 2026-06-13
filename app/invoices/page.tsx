"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, FileDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { PageContainer } from "@/components/page-container"
import { Kbd } from "@/components/kbd"
import { InvoiceTable } from "@/components/invoices/invoice-table"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useInvoices } from "@/lib/store"
import { routes } from "@/lib/routes"

export default function InvoicesPage() {
  const router = useRouter()
  const invoices = useInvoices()

  const createInvoice = React.useCallback(
    () => router.push(routes.newInvoice),
    [router]
  )

  useHotkeys([{ key: "n", handler: createInvoice }], [createInvoice])

  return (
    <PageContainer>
      <PageHeader
        title="Faktury"
        description={`${invoices.length} ${pluralizeInvoices(invoices.length)}`}
        actions={
          <Button onClick={createInvoice}>
            <Plus strokeWidth={2.8} />
            Nová faktura
            <Kbd className="ml-1 border-0 bg-primary-foreground/20 text-primary-foreground">
              N
            </Kbd>
          </Button>
        }
      />

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
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
        </div>
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
