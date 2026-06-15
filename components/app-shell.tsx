"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FileText, Users, Zap, Settings, LogOut, Eye, EyeOff } from "lucide-react"
import { motion, MotionConfig, LayoutGroup } from "motion/react"

import { cn } from "@/lib/utils"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { CommandMenu } from "@/components/command-menu"
import { transitions } from "@/components/motion"
import { routes } from "@/lib/routes"
import { usePrivacy } from "@/lib/privacy"

const nav = [
  { href: routes.invoices, label: "Faktury", icon: FileText, key: "1" },
  { href: routes.clients, label: "Klienti", icon: Users, key: "2" },
  { href: routes.reports, label: "Reporty", icon: Zap, key: "3" },
  { href: routes.settings, label: "Nastavení", icon: Settings, key: "4" },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    // reducedMotion="user" utlumí transformační animace, když to má uživatel
    // nastavené v systému (přístupnost).
    <MotionConfig reducedMotion="user">
      {/* Login běží bez navigace ani klávesových zkratek. */}
      {pathname === "/login" ? (
        children
      ) : (
        <AppChrome pathname={pathname}>{children}</AppChrome>
      )}
    </MotionConfig>
  )
}

function AppChrome({
  children,
  pathname,
}: {
  children: React.ReactNode
  pathname: string
}) {
  const router = useRouter()
  const { blurred, toggle } = usePrivacy()

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
      <LayoutGroup>
        <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-1 p-4 pt-8 md:flex">
          {nav.map((item, i) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <motion.div
                key={item.href}
                className="relative"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...transitions.easeOut, delay: 0.06 * i }}
              >
                {/* Klouzající indikátor — sdílený layoutId plynule přejede
                    mezi aktivními položkami při změně route. */}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-2xl bg-muted"
                    transition={transitions.spring}
                  />
                )}
                <Link
                  href={item.href}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 text-base transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon strokeWidth={2.4} className="size-6" />
                  <span>{item.label}</span>
                </Link>
              </motion.div>
            )
          })}

          <motion.button
            type="button"
            onClick={toggle}
            aria-pressed={blurred}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...transitions.easeOut, delay: 0.06 * nav.length }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "mt-auto flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 text-base transition-colors",
              blurred
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {blurred ? (
              <EyeOff strokeWidth={2.4} className="size-6" />
            ) : (
              <Eye strokeWidth={2.4} className="size-6" />
            )}
            <span>{blurred ? "Zobrazit ceny" : "Skrýt ceny"}</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={async () => {
              await fetch("/api/login", { method: "DELETE" })
              router.push("/login")
              router.refresh()
            }}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...transitions.easeOut, delay: 0.06 * (nav.length + 1) }}
            whileTap={{ scale: 0.97 }}
            className="flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 text-base text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut strokeWidth={2.4} className="size-6" />
            <span>Odhlásit</span>
          </motion.button>
        </aside>
      </LayoutGroup>

      {/* Main content */}
      <main className="min-w-0 flex-1 p-8 pt-12">{children}</main>

      <CommandMenu />
    </div>
  )
}
