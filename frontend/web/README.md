# Billisan admin web

React 18, TypeScript, Vite, TanStack Query and Zustand. Node.js 22.12+ and pnpm 9.15.9.
Copy `.env.example` to `.env.local`, set fictitious mock credentials, then run
`pnpm install --frozen-lockfile` and `pnpm dev`. Check with `pnpm test`, `pnpm build`.

All `VITE_*` values are public. Mock passwords are UI fixtures, never real admin passwords.
`VITE_AUTH_BYPASS` only works in development. For backend integration disable mock switches
and configure your own station in `src/features/stations/api/stationSeed.ts`.
See the root README and SECURITY.md for incomplete server session APIs and deployment requirements.
