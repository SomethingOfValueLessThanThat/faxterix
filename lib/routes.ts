// Central route map. URLs are English; the Czech UI labels live in components.
export const routes = {
  home: "/",
  invoices: "/invoices",
  newInvoice: "/invoices/new",
  invoice: (id: string) => `/invoices/${id}`,
  clients: "/clients",
  reports: "/reports",
  expenses: "/expenses",
  settings: "/settings",
} as const
