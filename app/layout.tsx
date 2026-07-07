import type { Metadata } from "next"
import { Outfit } from "next/font/google"

import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { AppShell } from "@/components/app-shell"
import { ConvexClientProvider } from "@/components/convex-provider"
import { cn } from "@/lib/utils"

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
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
      className={cn("antialiased", "font-sans", outfit.variable)}
    >
      <body>
        <ConvexClientProvider>
          <AppShell>{children}</AppShell>
        </ConvexClientProvider>
        <Toaster />
      </body>
    </html>
  )
}
