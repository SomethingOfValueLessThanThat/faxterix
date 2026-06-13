"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FileText, Users, Settings, Command as CommandIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { CommandMenu } from "@/components/command-menu"
import { Kbd } from "@/components/kbd"

const nav = [
  { href: "/faktury", label: "Faktury", icon: FileText, key: "1" },
  { href: "/klienti", label: "Klienti", icon: Users, key: "2" },
  { href: "/nastaveni", label: "Nastavení", icon: Settings, key: "3" },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // Rychlá navigace: Cmd+1 / Cmd+2 / Cmd+3
  useHotkeys(
    nav.map((item) => ({
      key: item.key,
      meta: true,
      handler: () => router.push(item.href),
    })),
    [router]
  )

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col border-r bg-muted/30 p-3 md:flex">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            FX
          </div>
          <span className="font-semibold tracking-tight">FAXTERIX</span>
        </div>

        <nav className="mt-2 flex flex-col gap-0.5">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-background font-medium text-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
              >
                <item.icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                <Kbd className="opacity-0 group-hover:opacity-100">
                  ⌘{item.key}
                </Kbd>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground">
          <CommandIcon className="size-3.5" />
          <span>Příkazy</span>
          <Kbd className="ml-auto">⌘K</Kbd>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
      <CommandMenu />
    </div>
  )
}
