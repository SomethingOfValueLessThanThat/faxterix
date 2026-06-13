import { redirect } from "next/navigation"
import { routes } from "@/lib/routes"

export default function Home() {
  // The invoice list is the app's landing page.
  redirect(routes.invoices)
}
