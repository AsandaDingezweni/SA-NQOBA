# SA-NQOBA frontend

The Expo (SDK 58) app for web, Android and iOS. See the root `README.md` for the full setup.

```bash
npm install
npx expo start --web       # dev server on http://localhost:8081, expects the API on :5000
npm run typecheck
npm run export:web         # static web build in dist/, served by the backend in production
```

Set `EXPO_PUBLIC_API_URL` to use an API other than `http://localhost:5000` in development.
