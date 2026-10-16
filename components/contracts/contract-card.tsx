"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  ExternalLink,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { fadeInUp } from "@/components/motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sensitive } from "@/components/ui/sensitive"
import { useContractApi } from "@/lib/store"
import { formatNotice, isExpired } from "@/lib/contracts"
import { formatDate } from "@/lib/format"
import type { Client, Contract, ContractTerms } from "@/lib/types"

export function ContractCard({
  contract,
  client,
  onEdit,
}: {
  contract: Contract
  client: Client | undefined
  onEdit: (contract: Contract) => void
}) {
  const contractApi = useContractApi()
  const { terms } = contract

  async function remove() {
    await contractApi.remove(contract._id)
    toast.success(`Smlouva ${contract.title} smazána.`)
  }

  return (
    <motion.div
      variants={fadeInUp}
      className="group flex flex-col rounded-lg border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate">{contract.title}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {client?.name ?? terms?.counterparty ?? contract.fileName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {isExpired(contract) && <Badge variant="secondary">Skončila</Badge>}
          <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {contract.fileUrl && (
              <Button
                variant="ghost"
                size="icon-sm"
                nativeButton={false}
                render={
                  <a href={contract.fileUrl} target="_blank" rel="noreferrer" />
                }
                aria-label="Otevřít PDF"
              >
                <ExternalLink />
              </Button>
            )}
            {contract.extraction === "done" && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(contract)}
                aria-label="Upravit"
              >
                <Pencil />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={remove}
              aria-label="Smazat"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>

      {contract.extraction === "pending" && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          AI čte smlouvu…
        </p>
      )}

      {contract.extraction === "failed" && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="size-4 shrink-0" />
            {contract.extractionError ?? "Výtah se nepovedl."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => contractApi.retry(contract._id)}
          >
            <RotateCcw />
            Zkusit znovu
          </Button>
        </div>
      )}

      {terms && <TermsDetail terms={terms} />}
    </motion.div>
  )
}

function TermsDetail({ terms }: { terms: ContractTerms }) {
  const validity = terms.endDate
    ? `${terms.startDate ? `${formatDate(terms.startDate)} – ` : "do "}${formatDate(terms.endDate)}`
    : "Na dobu neurčitou"

  return (
    <>
      <p className="mt-3 text-sm text-muted-foreground">{terms.summary}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        <Term label="Platnost">{validity}</Term>
        <Term label="Prodloužení">
          {terms.autoRenewal
            ? `Automaticky${terms.renewalMonths ? ` o ${terms.renewalMonths} měs.` : ""}`
            : "Ne"}
        </Term>
        {terms.notice && (
          <Term label="Výpovědní lhůta">{formatNotice(terms.notice)}</Term>
        )}
        {terms.rate && (
          <Term label="Sazba">
            <Sensitive>{terms.rate}</Sensitive>
          </Term>
        )}
        {terms.paymentDays !== undefined && (
          <Term label="Splatnost">{terms.paymentDays} dní</Term>
        )}
        {terms.confidentialityUntil && (
          <Term label="Mlčenlivost do">
            {formatDate(terms.confidentialityUntil)}
          </Term>
        )}
      </dl>
      {terms.keyPoints.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs text-muted-foreground">Pozor na</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm">
            {terms.keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function Term({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate tabular-nums">{children}</dd>
    </div>
  )
}
