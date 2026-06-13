import type { Metadata } from "next"
import { Geist_Mono, Outfit } from "next/font/google"

import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { AppShell } from "@/components/app-shell"
import { cn } from "@/lib/utils"

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "FAXTERIX — fakturace",
  description: "Rychlá fakturace ovládaná z klávesnice.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="cs"
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        outfit.variable
      )}
    >
      <body>
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  )
}
