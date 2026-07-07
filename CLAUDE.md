# FAXTERIX Guidelines

FAXTERIX is a single-user Czech invoicing app for a freelancer (OSVČ on paušální daň): invoices with QR payment (SPAYD), clients, recurring expenses, reports, PDF export, and automatic payment matching from bank-notification emails.

**Stack**: Next.js (App Router) · React 19 · TypeScript · Tailwind v4 · Convex (backend) · base-ui (`@base-ui/react`) · recharts 3 · motion · `@react-pdf/renderer` · sonner · zod

## Language Convention

- **UI text**: Czech (labels, buttons, toasts, empty states).
- **Code, file names, URLs, identifiers**: English (see `lib/routes.ts` — English URLs, Czech labels live in components).
- **Code comments**: Czech. Match the existing style — comments explain _why_ and non-obvious constraints, not what the next line does.

## Directory Structure

- `app/` — route pages. Pages are thin: they only render a `*View` component (e.g. `app/expenses/page.tsx` → `<ExpensesView />`). No logic in pages.
- `components/<feature>/` — feature components (`invoices/`, `clients/`, `expenses/`, `reports/`, `settings/`). The entry component is `<feature>-view.tsx`.
- `components/ui/` — shadcn-style primitives built on **base-ui, not Radix**. `data-slot` attributes, `cn()` composition.
- `components/` (root) — shared shell pieces: `app-shell`, `page-container`, `page-header`, `command-menu`, `motion/`.
- `lib/` — pure domain logic and helpers: `types.ts` (domain types), `store.tsx` (data layer), `format.ts`, `invoice.ts`, `reports.ts`, `expenses.ts`, `spayd.ts`, `bank-email.ts`, `pdf/`.
- `convex/` — backend functions and `schema.ts`.

## Rules

### Data Layer

- **All Convex access goes through `lib/store.tsx`.** Components use its hooks (`useClients`, `useInvoiceApi`, `useProfile`, …) — never call `useQuery(api.…)`/`useMutation(api.…)` directly in components.
- Read hooks return ready-to-use values (`useQuery(...) ?? []`); write hooks return a memoized `{ create, patch, remove }` object taking plain `string` ids and casting to `Id<"table">` internally.
- Domain types in `lib/types.ts` mirror `convex/schema.ts` 1:1. When changing the data model, update both, plus the payload pickers in `store.tsx`.
- Before writing any Convex code, read `convex/_generated/ai/guidelines.md` — it overrides training-data knowledge of Convex.

### UI System

- Use existing primitives from `components/ui/` first. They wrap **base-ui**: props types come from the primitive namespace (`DialogPrimitive.Root.Props`), state attributes are `data-open`/`data-closed`/`data-active` (tabs use `data-active`, **not** `data-selected`).
- Do NOT re-run the shadcn CLI over existing `components/ui/` files — several (notably `chart.tsx` for recharts 3) are hand-adapted and the CLI would clobber them.
- Every page uses `PageContainer` + `PageHeader` (title, description, `actions`). Entrance animations use `FadeIn` / `Stagger` / `StaggerItem` from `components/motion`.
- Amounts and other sensitive numbers render inside `<Sensitive>` so privacy mode (`lib/privacy.tsx`) can blur them.
- Money is formatted via `formatCZK` from `lib/format.ts` — never inline `toLocaleString`.
- **Never use a monospace font anywhere in the UI** (numbers, charts, IDs included). Sans only; `tabular-nums` is the tool for aligning digits. The only exception is the PDF invoice.

### Styling

- Tailwind v4 (CSS-based config in `app/globals.css`). Use existing design tokens/CSS variables; no magic color values, no custom CSS blocks in components.
- Compose class names with `cn()` from `lib/utils.ts`.

### State Management

- Server state lives in Convex (reactive via `lib/store.tsx` hooks). Local UI state is plain `useState` in the view.
- Derive values with `useMemo` during render — no `useState` for derivable data.
- Cross-page client-only state (e.g. privacy mode) uses `useSyncExternalStore` over `localStorage`, SSR-safe. Follow the `lib/privacy.tsx` pattern; no state libraries.

### Auth

- Single shared password. `middleware.ts` gates everything except `PUBLIC_PATHS` via the auth cookie; `app/api/login` issues it. Convex functions are single-tenant and have no per-user auth — keep it that way unless asked.
- The CloudMailin webhook (`convex/http.ts`) is public and protected by `CLOUDMAILIN_SECRET`; its public URL is on the `.convex.site` domain (with the region segment), not `.convex.cloud`.

### Code Patterns

- **Formatting**: Prettier — no semicolons, double quotes. Run `npm run format` after larger edits.
- **Components**: `export function Name()` declarations (not arrow consts), named exports only, no default exports except `app/` pages.
- **Files**: kebab-case (`expense-dialog.tsx`, `use-hotkeys.ts`).
- **Imports**: `react` / node_modules first, blank line, then `@/` imports. Use `import * as React from "react"` + `React.useState` style in components.
- **Dates**: ISO `yyyy-mm-dd` strings for invoice dates; epoch millis for `createdAt`/`updatedAt`.
- Client components start with `"use client"`; a top-of-file Czech comment block explains the module's purpose for non-trivial files.

### Verification

- `npm run typecheck` and `npm run lint` must pass. Dev servers: `npm run dev` (Next) and `npm run convex` (Convex) run side by side.

### General Advice

- This is a small personal app — prefer the simplest solution that fits the existing patterns over generic abstractions.
- Don't add code comments unless they carry real information (in Czech, per convention).
