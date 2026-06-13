"use client"

import { use } from "react"

import { InvoiceEditor } from "@/components/invoice-editor"
import { PageContainer } from "@/components/page-container"

export default function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return (
    <PageContainer>
      <InvoiceEditor invoiceId={id} />
    </PageContainer>
  )
}
