# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start development server (Turbopack, localhost:3000)
npm run build    # Production build (Turbopack)
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test runner is configured.

## Stack

- **Next.js 16.2.6** — App Router only; Pages Router is not used
- **React 19.2** — with canary features (View Transitions, Activity, useEffectEvent)
- **TypeScript 5** (strict mode)
- **Tailwind CSS v4** — configured via `@tailwindcss/postcss` in `postcss.config.mjs`; theme tokens defined with `@theme inline` in `globals.css`
- **Geist** font family loaded via `next/font/google`

Path alias: `@/*` maps to the project root.

## Next.js 16 Breaking Changes

This version has several breaking changes from what most training data covers. Read `node_modules/next/dist/docs/` before writing code that touches affected APIs.

**Async Request APIs (fully removed sync access):**
- `cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams` are now async-only — `await` them everywhere
- Use `npx next typegen` to generate `PageProps`, `LayoutProps`, `RouteContext` helpers for type-safe async params

**Turbopack is now the default** for both `next dev` and `next build`. Custom `webpack` configs will break the build — use `next build --webpack` to opt out.

**Caching APIs:**
- `revalidateTag` now requires a second `cacheLife` profile argument: `revalidateTag('key', 'max')`
- `unstable_cacheLife` / `unstable_cacheTag` are now stable: import as `cacheLife` / `cacheTag` from `next/cache`
- New `updateTag` (Server Actions only) for immediate read-your-writes cache invalidation
- New `refresh()` from `next/cache` to refresh the client router from a Server Action

**PPR:** `experimental_ppr` route segment config is removed; use `cacheComponents` in `next.config.ts` instead.

**Routing:** `middleware` file convention is deprecated; use `proxy.ts` instead.

**ESLint:** `next lint` CLI is removed; use `eslint` directly (already configured in `package.json`).

**Image/sitemap generators:** `params` and `id` in `opengraph-image`, `twitter-image`, `icon`, `apple-icon`, and `sitemap` generating functions are now Promises — `await` them.

**Node.js:** Minimum version is 20.9.0.
