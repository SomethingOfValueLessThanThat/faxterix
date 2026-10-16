"use client"

// Náhled PDF faktury přímo v aplikaci. PDF se vyrenderuje do blobu a zobrazí
// v iframe nativním prohlížečem PDF; stažení použije tentýž blob, takže se
// dokument negeneruje znovu.

import * as React from "react"
import { FileDown, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sensitive } from "@/components/ui/sensitive"
import { useProfile } from "@/lib/store"
import {
  invoicePdfFileName,
  renderInvoicePdf,
  saveBlob,
} from "@/lib/pdf/generate"
import type { Invoice } from "@/lib/types"

type Rendered =
  | { invoice: Invoice; blob: Blob; url: string }
  | { invoice: Invoice; error: true }

export function InvoicePdfDialog({
  invoice,
  onClose,
}: {
  invoice: Invoice | null
  onClose: () => void
}) {
  const profile = useProfile()
  const [rendered, setRendered] = React.useState<Rendered | null>(null)

  React.useEffect(() => {
    if (!invoice) return
    let active = true
    let url: string | null = null
    renderInvoicePdf(invoice, profile)
      .then((blob) => {
        if (!active) return
        url = URL.createObjectURL(blob)
        setRendered({ invoice, blob, url })
      })
      .catch((err) => {
        console.error(err)
        if (active) setRendered({ invoice, error: true })
      })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [invoice, profile])

  // Výsledek platí jen pro aktuálně zobrazenou fakturu (jinak je zastaralý).
  const current = rendered && rendered.invoice === invoice ? rendered : null

  return (
    <Dialog open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[90dvh] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader className="flex-row items-center gap-3 pr-10">
          <DialogTitle>Faktura {invoice?.number}</DialogTitle>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={!current || "error" in current}
            onClick={() =>
              current &&
              "blob" in current &&
              saveBlob(current.blob, invoicePdfFileName(current.invoice))
            }
          >
            <FileDown />
            Stáhnout
          </Button>
        </DialogHeader>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/50">
          {current && "url" in current ? (
            <Sensitive className="block size-full">
              <iframe
                src={`${current.url}#view=FitH`}
                title={`Faktura ${current.invoice.number}`}
                className="size-full"
              />
            </Sensitive>
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              {current ? (
                "Nepodařilo se vytvořit PDF."
              ) : (
                <Loader2 className="size-5 animate-spin" />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
