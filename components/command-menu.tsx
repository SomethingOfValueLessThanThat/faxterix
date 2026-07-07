"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  FileText,
  Users,
  ChartColumn,
  Wallet,
  Settings,
  Plus,
  FileDown,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useInvoices } from "@/lib/store"
import { routes } from "@/lib/routes"

export function CommandMenu() {
  const [open, setOpen] = React.useState(false)
  const invoices = useInvoices()
  const router = useRouter()

  useHotkeys(
    [
      {
        key: "k",
        meta: true,
        allowInInput: true,
        handler: () => setOpen((v) => !v),
        description: "Příkazová paleta",
      },
    ],
    []
  )

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Hledat příkaz nebo fakturu…" />
      <CommandList>
        <CommandEmpty>Nic nenalezeno.</CommandEmpty>
        <CommandGroup heading="Akce">
          <CommandItem onSelect={() => go(routes.newInvoice)}>
            <Plus />
            Nová faktura
          </CommandItem>
          <CommandItem onSelect={() => go(`${routes.clients}?new=1`)}>
            <Users />
            Nový klient
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Přejít na">
          <CommandItem onSelect={() => go(routes.invoices)}>
            <FileText />
            Faktury
          </CommandItem>
          <CommandItem onSelect={() => go(routes.clients)}>
            <Users />
            Klienti
          </CommandItem>
          <CommandItem onSelect={() => go(routes.reports)}>
            <ChartColumn />
            Reporty
          </CommandItem>
          <CommandItem onSelect={() => go(routes.expenses)}>
            <Wallet />
            Výdaje
          </CommandItem>
          <CommandItem onSelect={() => go(routes.settings)}>
            <Settings />
            Nastavení
          </CommandItem>
        </CommandGroup>
        {invoices.length > 0 && (
          <CommandGroup heading="Faktury">
            {invoices.slice(0, 8).map((inv) => (
              <CommandItem
                key={inv._id}
                value={`${inv.number} ${inv.client?.name ?? ""}`}
                onSelect={() => go(routes.invoice(inv._id))}
              >
                <FileDown />
                {inv.number}
                <span className="text-muted-foreground">
                  {inv.client?.name}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
