# Billisan kiosk

React 19, TypeScript, Vite and Tailwind. Node.js 22.12+.
Copy `.env.example` to `.env.local`, then `npm ci` and `npm run dev`.
Check with `npm run build` and `npm run lint`.

Set `VITE_PI_MOCK=true` for the operation UI demo; use your own Pi WebSocket service for
real devices. Device service code and face matching are not included.
Camera preview is optional and requires an authenticated trusted proxy. No stream credential
belongs in frontend environment variables. See the root SECURITY.md before using real images.
