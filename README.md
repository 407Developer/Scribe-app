# Epistola — Write with Scripture

A distraction-free word processor that quotes the King James Bible as you write.
Built for theological essays, letters, and apologetics.

Type a reference — `John 3:16`, `Ps 23:1-3, 6`, `1 Cor 13:4-7` — and it highlights as you type.
Press **Shift+Enter** (or tap the highlight on a phone) to insert the KJV text right after it as a blockquote,
even if you keep typing past the reference. Works fully **offline** as an installable PWA.

Hand it in: export to **DOCX**, **PDF** (print dialog), **HTML** or **TXT**, copy, or share via the native share sheet.

## Stack
- React 19 + TypeScript + Vite 8
- TipTap (ProseMirror) editor with a custom linear-time Bible-reference scanner
- KJV dataset generated from `public/data/kjv.json` (via `scripts/build-bible-data.mjs`)

## Scripts
- `npm run dev` — local dev server
- `npm run build` — typecheck + production build (PWA-ready, service worker caches the app + KJV data)
- `npm run preview` — serve the production build
- `npm run lint` — oxlint

## Data
- `public/data/kjv.json` — full KJV text (4.2 MB)
- `public/data/books.json` — book metadata (names + chapter counts)

## Branding
Name: **Epistola** (Latin for "letter/epistle"). Mark: a folded letter forming an E, closed with a gold wax seal.