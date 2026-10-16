"use client"

// Trezor smluv: nahrání PDF, AI výtah podmínek a přehled termínů (výpověď před
// automatickým prodloužením, konec smlouvy, konec mlčenlivosti).

import * as React from "react"
import { CalendarClock, FileSignature, Upload } from "lucide-react"
import { toast } from "sonner"

import { PageContainer } from "@/components/page-container"
import { PageHeader } from "@/components/page-header"
import { FadeIn, Stagger } from "@/components/motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ContractCard } from "@/components/contracts/contract-card"
import { ContractDialog } from "@/components/contracts/contract-dialog"
import { useClients, useContractApi, useContracts } from "@/lib/store"
import {
  DEADLINE_LABELS,
  URGENT_DAYS,
  formatDaysLeft,
  upcomingDeadlines,
} from "@/lib/contracts"
import { formatDate } from "@/lib/format"
import type { Contract } from "@/lib/types"

export function ContractsView() {
  const contracts = useContracts()
  const clients = useClients()
  const contractApi = useContractApi()
  const fileInput = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [editing, setEditing] = React.useState<Contract | null>(null)

  const deadlines = React.useMemo(
    () => upcomingDeadlines(contracts),
    [contracts]
  )

  async function upload(files: FileList | null) {
    const pdfs = [...(files ?? [])].filter((f) => f.type === "application/pdf")
    if (pdfs.length === 0) {
      toast.error("Nahrát jde jen PDF.")
      return
    }
    setUploading(true)
    try {
      for (const file of pdfs) await contractApi.upload(file)
      toast.success(
        pdfs.length === 1
          ? "Smlouva nahrána, AI ji teď čte."
          : `Nahráno ${pdfs.length} smluv, AI je teď čte.`
      )
    } catch {
      toast.error("Nahrání se nezdařilo.")
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  const uploadButton = (
    <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
      <Upload />
      {uploading ? "Nahrávám…" : "Nahrát smlouvu"}
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        title="Smlouvy"
        description="Trezor smluv a hlídání jejich termínů"
        actions={uploadButton}
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />

      {contracts.length === 0 ? (
        <FadeIn className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <FileSignature className="size-8 text-muted-foreground" />
          <h2 className="mt-4">Zatím žádné smlouvy</h2>
          <p className="mt-1 max-w-sm text-sm text-balance text-muted-foreground">
            Nahrajte smlouvu v PDF. AI z ní vytáhne výpovědní lhůty, automatické
            prodloužení, sazbu a riziková ustanovení.
          </p>
          <div className="mt-4">{uploadButton}</div>
        </FadeIn>
      ) : (
        <div className="flex flex-col gap-6">
          {deadlines.length > 0 && (
            <FadeIn>
              <Card>
                <CardHeader>
                  <CardTitle>Nadcházející termíny</CardTitle>
                  <CardDescription>Příštích 90 dní</CardDescription>
                </CardHeader>
                <CardContent className="divide-y">
                  {deadlines.map((d) => (
                    <div
                      key={`${d.contractId}-${d.kind}`}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{DEADLINE_LABELS[d.kind]}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {d.contractTitle}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm tabular-nums">
                          {formatDate(d.date)}
                        </p>
                        {d.daysLeft <= URGENT_DAYS ? (
                          <Badge variant="warning">
                            {formatDaysLeft(d.daysLeft)}
                          </Badge>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {formatDaysLeft(d.daysLeft)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </FadeIn>
          )}

          <Stagger className="grid gap-3 lg:grid-cols-2">
            {contracts.map((contract) => (
              <ContractCard
                key={contract._id}
                contract={contract}
                client={clients.find((c) => c._id === contract.clientId)}
                onEdit={setEditing}
              />
            ))}
          </Stagger>
        </div>
      )}

      <ContractDialog
        contract={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </PageContainer>
  )
}
