import * as React from "react"
import { cn } from "@/lib/utils"

/** Shared max-width content wrapper used by every route page. */
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("w-full max-w-5xl", className)}>{children}</div>
  )
}
