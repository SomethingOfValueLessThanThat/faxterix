import { InvoiceEditor } from "@/components/invoice-editor"
import { PageContainer } from "@/components/page-container"

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams
  return (
    <PageContainer>
      <InvoiceEditor key={from} duplicateOf={from} />
    </PageContainer>
  )
}
