"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, FileDown, Trash2 } from "lucide-react"
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
import type { Invoice, InvoiceStatus } from "@/lib/types"

const statusMeta: Record<
  InvoiceStatus,
  { label: string; variant: "outline" | "info" | "success" }
> = {
  draft: { label: "Koncept", variant: "outline" },
  sent: { label: "Odesláno", variant: "info" },
  paid: { label: "Zaplaceno", variant: "success" },
}

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  const router = useRouter()
  const profile = useProfile()

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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Číslo</TableHead>
          <TableHead>Klient</TableHead>
          <TableHead>Vystaveno</TableHead>
          <TableHead>Splatnost</TableHead>
          <TableHead>Stav</TableHead>
          <TableHead className="text-right">Částka</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => {
          const total = computeTotals(invoice.items, profile.vatPayer).total
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
