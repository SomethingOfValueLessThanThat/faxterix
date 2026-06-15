"use client"

import { PageTransition } from "@/components/motion"

/**
 * Next.js `template.tsx` se při každé navigaci remountuje, takže obsah stránky
 * pokaždé čistě nabíhá. Sidebar žije v layoutu, takže zůstává zachovaný.
 */
export default function Template({
  children,
}: {
  children: React.ReactNode
}) {
  return <PageTransition>{children}</PageTransition>
}
