"use client"

import * as React from "react"

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

export interface Hotkey {
  /** Klávesa, např. "n", "k", "Enter". Porovnává se case-insensitive. */
  key: string
  meta?: boolean // Cmd / Ctrl
  shift?: boolean
  /** Povolit i při psaní do inputu (výchozí false). */
  allowInInput?: boolean
  handler: (e: KeyboardEvent) => void
  description?: string
}

/**
 * Globální klávesové zkratky. `meta` matchuje Cmd (macOS) i Ctrl.
 * Handlery se čtou přes ref, takže vždy vidí aktuální stav bez re-bindingu.
 */
export function useHotkeys(
  hotkeys: Hotkey[],
  // Deps nejsou potřeba (handlery se čtou přes ref), ale podporujeme je
  // pro zpětnou kompatibilitu volajících.
  _deps?: React.DependencyList
) {
  const ref = React.useRef(hotkeys)

  React.useEffect(() => {
    ref.current = hotkeys
  })

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat) return

      for (const hk of ref.current) {
        const meta = e.metaKey || e.ctrlKey
        if (hk.key.toLowerCase() !== e.key.toLowerCase()) continue
        if (!!hk.meta !== meta) continue
        if (!!hk.shift !== e.shiftKey) continue
        if (!hk.allowInInput && isTypingTarget(e.target)) continue

        e.preventDefault()
        hk.handler(e)
        return
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
