"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { PageContainer } from "@/components/page-container"
import { Kbd } from "@/components/kbd"
import { ClientDialog } from "@/components/client-dialog"
import { ClientCard } from "@/components/clients/client-card"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useClients } from "@/lib/store"
import { routes } from "@/lib/routes"
import type { Client } from "@/lib/types"

function ClientsView() {
  const router = useRouter()
  const params = useSearchParams()
  const clients = useClients()
  const [editingClient, setEditingClient] = React.useState<Client | undefined>()
  const [manualOpen, setManualOpen] = React.useState(false)

  // The command palette requests the "new client" dialog via ?new=1.
  const wantsNew = params.get("new") !== null
  const dialogOpen = manualOpen || wantsNew

  const openNew = React.useCallback(() => {
    setEditingClient(undefined)
    setManualOpen(true)
  }, [])

  const openEdit = React.useCallback((client: Client) => {
    setEditingClient(client)
    setManualOpen(true)
  }, [])

  function handleOpenChange(next: boolean) {
    setManualOpen(next)
    if (!next) {
      setEditingClient(undefined)
      if (wantsNew) router.replace(routes.clients)
    }
  }

  useHotkeys([{ key: "n", handler: openNew }], [openNew])

  return (
    <PageContainer>
      <PageHeader
        title="Klienti"
        description={`${clients.length} v adresáři`}
        actions={
          <Button onClick={openNew}>
            <Plus />
            Nový klient
            <Kbd className="ml-1 border-0 bg-primary-foreground/20 text-primary-foreground">
              N
            </Kbd>
          </Button>
        }
      />

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <Users className="size-8 text-muted-foreground" />
          <h2 className="mt-4">Adresář je prázdný</h2>
          <p className="mt-1 max-w-sm text-sm text-balance text-muted-foreground">
            Přidejte klienta a načtěte jeho údaje z ARES podle IČO.
          </p>
          <Button onClick={openNew} className="mt-4">
            <Plus />
            Nový klient
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <ClientCard key={client._id} client={client} onEdit={openEdit} />
          ))}
        </div>
      )}

      <ClientDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        client={editingClient}
      />
    </PageContainer>
  )
}

export default function ClientsPage() {
  // useSearchParams must live under a Suspense boundary.
  return (
    <React.Suspense>
      <ClientsView />
    </React.Suspense>
  )
}
