"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { usePrivacy } from "@/lib/privacy"

// Obalí citlivý obsah (typicky částku). Když je zapnutý režim soukromí,
// obsah se rozostří a nedá se označit. Výchozí render je inline span;
// pro blokové prvky (input, QR) předej `className="block"`.
export function Sensitive({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { blurred } = usePrivacy()
  return (
    <span
      className={cn(
        "transition-[filter,opacity] duration-200",
        blurred && "pointer-events-none select-none blur-sm",
        className
      )}
    >
      {children}
    </span>
  )
}
