"use client"

import * as React from "react"
import { FileText, Users, Settings, Plus, FileDown } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useInvoices } from "@/lib/store"
import { useAppNav } from "@/lib/app-nav"

export function CommandMenu() {
  const [open, setOpen] = React.useState(false)
  const invoices = useInvoices()
  const { navigate } = useAppNav()

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

  function run(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Hledat příkaz nebo fakturu…" />
      <CommandList>
        <CommandEmpty>Nic nenalezeno.</CommandEmpty>
        <CommandGroup heading="Akce">
          <CommandItem onSelect={() => run(() => navigate({ type: "new-invoice" }))}>
            <Plus />
            Nová faktura
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ type: "new-client" }))}>
            <Users />
            Nový klient
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Přejít na">
          <CommandItem onSelect={() => run(() => navigate({ type: "tab", tab: "faktury" }))}>
            <FileText />
            Faktury
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ type: "tab", tab: "klienti" }))}>
            <Users />
            Klienti
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ type: "tab", tab: "nastaveni" }))}>
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
                onSelect={() => run(() => navigate({ type: "edit-invoice", id: inv._id }))}
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
