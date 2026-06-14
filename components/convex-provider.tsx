"use client"

import * as React from "react"
import { ConvexProvider, ConvexReactClient } from "convex/react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  if (!convex) {
    // Bez nakonfigurovaného deploymentu (chybí NEXT_PUBLIC_CONVEX_URL) appku
    // nespouštíme „naprázdno" – jasná hláška místo tichého selhání dotazů.
    return (
      <div className="flex min-h-svh items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <p className="max-w-md">
          Convex backend není nakonfigurován. Spusťte{" "}
          <code className="rounded bg-muted px-1 py-0.5">npx convex dev</code> –
          vytvoří deployment a zapíše <code>NEXT_PUBLIC_CONVEX_URL</code> do{" "}
          <code>.env.local</code>.
        </p>
      </div>
    )
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
