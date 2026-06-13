"use client"

import * as React from "react"

export type AppTab = "faktury" | "klienti" | "nastaveni"

export type NavAction =
  | { type: "tab"; tab: AppTab }
  | { type: "new-invoice" }
  | { type: "edit-invoice"; id: string }
  | { type: "new-client" }

interface AppNavContextValue {
  navigate: (action: NavAction) => void
}

export const AppNavContext = React.createContext<AppNavContextValue>({
  navigate: () => {},
})

export function useAppNav() {
  return React.useContext(AppNavContext)
}
