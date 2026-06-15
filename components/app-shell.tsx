"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FileText, Users, Zap, Settings, LogOut } from "lucide-react"

import { cn } from "@/lib/utils"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { CommandMenu } from "@/components/command-menu"
import { routes } from "@/lib/routes"

const nav = [
  { href: routes.invoices, label: "Faktury", icon: FileText, key: "1" },
  { href: routes.clients, label: "Klienti", icon: Users, key: "2" },
  { href: routes.reports, label: "Reporty", icon: Zap, key: "3" },
  { href: routes.settings, label: "Nastavení", icon: Settings, key: "4" },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Login běží bez navigace ani klávesových zkratek.
  if (pathname === "/login") {
    return <>{children}</>
  }

  return <AppChrome pathname={pathname}>{children}</AppChrome>
}

function AppChrome({
  children,
  pathname,
}: {
  children: React.ReactNode
  pathname: string
}) {
  const router = useRouter()

  // Quick navigation: Cmd+1 / Cmd+2 / Cmd+3
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
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-1 p-4 pt-8 md:flex">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 text-base transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon strokeWidth={2.4} className="size-6" />
              <span>{item.label}</span>
            </Link>
          )
        })}

        <button
          type="button"
          onClick={async () => {
            await fetch("/api/login", { method: "DELETE" })
            router.push("/login")
            router.refresh()
          }}
          className="mt-auto flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 text-base text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut strokeWidth={2.4} className="size-6" />
          <span>Odhlásit</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 p-8 pt-12">{children}</main>

      <CommandMenu />
    </div>
  )
}
