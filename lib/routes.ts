// Central route map. URLs are English; the Czech UI labels live in components.
export const routes = {
  home: "/",
  invoices: "/invoices",
  newInvoice: "/invoices/new",
  duplicateInvoice: (id: string) => `/invoices/new?from=${id}`,
  invoice: (id: string) => `/invoices/${id}`,
  clients: "/clients",
  reports: "/reports",
  expenses: "/expenses",
  contracts: "/contracts",
  settings: "/settings",
} as const
