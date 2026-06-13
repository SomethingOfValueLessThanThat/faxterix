"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  MoreHorizontal,
  Pencil,
  FileDown,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useProfile, invoiceApi } from "@/lib/store"
import { computeTotals } from "@/lib/invoice"
import { formatCZK, formatDate } from "@/lib/format"
import { downloadInvoicePdf } from "@/lib/pdf/generate"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { Invoice, InvoiceStatus } from "@/lib/types"

const statusMeta: Record<
  InvoiceStatus,
  { label: string; variant: "outline" | "info" | "success" }
> = {
  draft: { label: "Koncept", variant: "outline" },
  sent: { label: "Odesláno", variant: "info" },
  paid: { label: "Zaplaceno", variant: "success" },
}

const statusOrder: Record<InvoiceStatus, number> = {
  draft: 0,
  sent: 1,
  paid: 2,
}

type SortKey = "number" | "client" | "issueDate" | "dueDate" | "status" | "total"
type SortDirection = "asc" | "desc"

interface SortState {
  key: SortKey
  direction: SortDirection
}

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  const router = useRouter()
  const profile = useProfile()
  const [sort, setSort] = React.useState<SortState>({
    key: "number",
    direction: "desc",
  })

  const totals = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const invoice of invoices) {
      map.set(invoice._id, computeTotals(invoice.items, profile.vatPayer).total)
    }
    return map
  }, [invoices, profile.vatPayer])

  const sortedInvoices = React.useMemo(() => {
    const factor = sort.direction === "asc" ? 1 : -1
    return [...invoices].sort((a, b) => {
      let diff = 0
      switch (sort.key) {
        case "number":
          diff = a.number.localeCompare(b.number, "cs", { numeric: true })
          break
        case "client":
          diff = (a.client?.name ?? "").localeCompare(
            b.client?.name ?? "",
            "cs"
          )
          break
        case "issueDate":
          diff = a.issueDate.localeCompare(b.issueDate)
          break
        case "dueDate":
          diff = a.dueDate.localeCompare(b.dueDate)
          break
        case "status":
          diff = statusOrder[a.status] - statusOrder[b.status]
          break
        case "total":
          diff = (totals.get(a._id) ?? 0) - (totals.get(b._id) ?? 0)
          break
      }
      return diff * factor
    })
  }, [invoices, sort, totals])

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    )
  }

  async function openPdf(invoice: Invoice) {
    try {
      await downloadInvoicePdf(invoice, profile)
    } catch (err) {
      console.error(err)
      toast.error("Nepodařilo se vytvořit PDF.")
    }
  }

  function remove(id: string, number: string) {
    invoiceApi.remove(id)
    toast.success(`Faktura ${number} smazána.`)
  }

  function SortableHead({
    sortKey,
    children,
    align = "left",
  }: {
    sortKey: SortKey
    children: React.ReactNode
    align?: "left" | "right"
  }) {
    const active = sort.key === sortKey
    const Icon = !active
      ? ChevronsUpDown
      : sort.direction === "asc"
        ? ChevronUp
        : ChevronDown
    return (
      <TableHead className={align === "right" ? "text-right" : undefined}>
        <button
          type="button"
          onClick={() => toggleSort(sortKey)}
          className={cn(
            "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase transition-colors hover:text-foreground",
            align === "right" && "flex-row-reverse",
            active && "text-foreground"
          )}
        >
          {children}
          <Icon
            className={cn(
              "size-3.5 shrink-0",
              active ? "opacity-100" : "opacity-40"
            )}
          />
        </button>
      </TableHead>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead sortKey="number">Číslo</SortableHead>
          <SortableHead sortKey="client">Klient</SortableHead>
          <SortableHead sortKey="issueDate">Vystaveno</SortableHead>
          <SortableHead sortKey="dueDate">Splatnost</SortableHead>
          <SortableHead sortKey="status">Stav</SortableHead>
          <SortableHead sortKey="total" align="right">
            Částka
          </SortableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedInvoices.map((invoice) => {
          const total = totals.get(invoice._id) ?? 0
          const meta = statusMeta[invoice.status]
          return (
            <TableRow
              key={invoice._id}
              className="cursor-pointer"
              onClick={() => router.push(routes.invoice(invoice._id))}
            >
              <TableCell>{invoice.number}</TableCell>
              <TableCell className="text-muted-foreground">
                {invoice.client?.name ?? "—"}
              </TableCell>
              <TableCell>{formatDate(invoice.issueDate)}</TableCell>
              <TableCell>{formatDate(invoice.dueDate)}</TableCell>
              <TableCell>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </TableCell>
              <TableCell className="text-right">{formatCZK(total)}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => router.push(routes.invoice(invoice._id))}
                    >
                      <Pencil />
                      Upravit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openPdf(invoice)}>
                      <FileDown />
                      Stáhnout PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => remove(invoice._id, invoice.number)}
                    >
                      <Trash2 />
                      Smazat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
