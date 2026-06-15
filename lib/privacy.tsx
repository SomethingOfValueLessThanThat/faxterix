"use client"

// Režim soukromí: rozostří citlivé částky v UI, aby šlo aplikaci ukázat
// někomu dalšímu bez odhalení reálných čísel. Stav držíme v localStorage a
// čteme přes useSyncExternalStore — přežije přechody mezi stránkami i reload
// a je SSR-safe (na serveru je vždy `false`).

import * as React from "react"

const STORAGE_KEY = "faxterix:privacy"
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  // `storage` event chytí změnu z jiné záložky.
  window.addEventListener("storage", callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener("storage", callback)
  }
}

function write(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
  } catch {
    // localStorage může být nedostupný (private mode) — změnu prostě neuložíme.
  }
  for (const callback of listeners) callback()
}

export function usePrivacy() {
  const blurred = React.useSyncExternalStore(subscribe, read, () => false)

  return React.useMemo(
    () => ({
      blurred,
      setBlurred: (value: boolean) => write(value),
      toggle: () => write(!read()),
    }),
    [blurred]
  )
}
