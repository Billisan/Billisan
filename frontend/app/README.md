# Billisan user app

React Native 0.81, Expo SDK 54, TypeScript, TanStack Query, Zustand and NativeWind.
Copy `.env.example` to `.env`, then `npm ci` and `npm start` (Expo Go), or
`npm run android` / `npm run ios`. Type-check with `npx tsc --noEmit`.

`EXPO_PUBLIC_*` values are bundled into the client, so never put secrets there. The Kakao
map key must be restricted to your own registered domains. To build an APK with EAS, set
your own `extra.eas.projectId` in `app.json` and use the `preview` profile in `eas.json`.
