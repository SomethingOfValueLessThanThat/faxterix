# FAXTERIX

Keyboard-driven Czech invoicing app. Next.js 16 (App Router) + TypeScript +
Tailwind 4 + shadcn/ui on base-ui. Convex backend.

## How it works

- **Pages** (`app/`): invoices (list, `new`, `[id]` editor), clients, reports,
  settings. UI lives in `components/` (one folder per feature + shared `ui/`).
- **Data layer** (`lib/store.tsx`): the single source for reads/writes. It wraps
  Convex `useQuery`/`useMutation` in small hooks (`useClients`, `useInvoices`,
  `useProfile`, `useClientApi`, …). Components only touch these hooks, never
  Convex directly.
- **Backend** (`convex/`): `clients.ts`, `invoices.ts`, `profile.ts` (singleton),
  `data.ts` (bulk CSV import). Schema in `schema.ts` mirrors `lib/types.ts`.
- **PDF + QR** generated client-side (`lib/pdf/*` via `@react-pdf/renderer`,
  `lib/spayd.ts` + `qrcode` for SPAYD QR payment; needs IBAN in settings).
- **ARES lookup** (fill company by IČO): route handler `app/api/ares/route.ts`.
- **Keyboard shortcuts**: `hooks/use-hotkeys.ts`, command palette via `cmdk`
  (`⌘K`); `⌘1/2/3` navigate, `N` new, `⌘S` save.

Dev: `npm run dev` (app) + `npm run convex` (backend). Check with
`npm run typecheck` and `npm run lint`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
