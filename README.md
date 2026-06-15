# FAXTERIX

Rychlá fakturace ovládaná z klávesnice. Next.js 16 + TypeScript + Tailwind 4 +
shadcn/ui (base-ui).

## Spuštění

```bash
npm run dev      # vývojový server na http://localhost:3000
npm run convex   # Convex backend (vývoj)
npm run build    # produkční build
npm run typecheck
npm run lint
```

## Co umí (1. iterace)

- **Faktury** – vytvoření a úprava, položky s výpočtem DPH, stavy
  (koncept / odesláno / zaplaceno).
- **Export do PDF** – přímé stažení PDF s diakritikou (vložený font Roboto).
- **QR Platba** – QR kód ve formátu SPAYD na PDF (vyžaduje IBAN v nastavení).
- **Adresář klientů** – název, IČO, DIČ, adresa, e-mail.
- **Načtení z ARES** – automatické vyplnění firmy podle IČO
  (`/api/ares?ico=...`).
- **Nastavení** – údaje dodavatele, plátcovství DPH, platební údaje, formát
  čísla faktury.

## Klávesové zkratky

| Zkratka      | Akce                       |
| ------------ | -------------------------- |
| `⌘K`         | Příkazová paleta           |
| `⌘1 / ⌘2 / ⌘3` | Faktury / Klienti / Nastavení |
| `N`          | Nová faktura / nový klient |
| `⌘S`         | Uložit (editor, nastavení) |
| `⌘↵`         | Uložit klienta v dialogu   |
| `D`          | Přepnout světlý/tmavý režim |

## Architektura

- Backend běží na [Convexu](https://convex.dev) (`convex/clients.ts`,
  `invoices.ts`, `profile.ts` jako singleton, `data.ts` pro hromadný import).
  Schéma `convex/schema.ts` zrcadlí doménové typy v `lib/types.ts`.
- Datová vrstva `lib/store.tsx` je jediný zdroj čtení i zápisů – obaluje Convex
  `useQuery`/`useMutation` do malých hooků (`useClients`, `useInvoices`,
  `useProfile`, `useClientApi`, …). Komponenty sahají jen na tyto hooky, nikdy
  na Convex přímo.
- PDF a QR se generují na klientu (`lib/pdf/*`, `@react-pdf/renderer`;
  SPAYD QR přes `lib/spayd.ts` + `qrcode`), font Roboto (latin-ext) je
  v `public/fonts`.
- ARES běží přes route handler `app/api/ares/route.ts`.

## Další kroky

Šablony pravidelných faktur a další rozšíření importu
(`invoiceApi.importMany` zvládá hromadný import, např. CSV z Fakturoidu).
