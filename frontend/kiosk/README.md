# Billisan kiosk

React 19, TypeScript, Vite and Tailwind. Node.js 22.12+.
Copy `.env.example` to `.env.local`, then `npm ci` and `npm run dev`.
Check with `npm run build` and `npm run lint`.

Set `VITE_PI_MOCK=true` for the operation UI demo. For real devices, run the Pi service in
`iot/pi`; face matching runs on the Jetson service in `iot/orin`.
Camera preview is optional and requires an authenticated trusted proxy. No stream credential
belongs in frontend environment variables. See the root SECURITY.md before using real images.
