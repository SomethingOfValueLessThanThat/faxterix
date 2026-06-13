"use client"

import { Pencil, Trash2, Mail } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { clientApi } from "@/lib/store"
import type { Client } from "@/lib/types"

export function ClientCard({
  client,
  onEdit,
}: {
  client: Client
  onEdit: (client: Client) => void
}) {
  function remove() {
    clientApi.remove(client._id)
    toast.success(`Klient ${client.name} smazán.`)
  }

  return (
    <div className="group flex flex-col rounded-lg border p-4 transition-colors hover:border-foreground/20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate">{client.name}</h3>
          {client.ico ? (
            <p className="text-xs text-muted-foreground">
              IČO {client.ico}
              {client.dic ? ` · DIČ ${client.dic}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(client)}
            aria-label="Upravit"
          >
            <Pencil />
          </Button>
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
      <div className="mt-3 space-y-0.5 text-sm text-muted-foreground">
        {client.address.street ? <p>{client.address.street}</p> : null}
        {client.address.zip || client.address.city ? (
          <p>
            {[client.address.zip, client.address.city]
              .filter(Boolean)
              .join(" ")}
          </p>
        ) : null}
        {client.email ? (
          <p className="flex items-center gap-1.5 pt-1">
            <Mail className="size-3.5" />
            {client.email}
          </p>
        ) : null}
      </div>
    </div>
  )
}
