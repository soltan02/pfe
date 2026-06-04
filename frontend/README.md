# STB Security - Frontend

Angular frontend for the STB security agent management app.

## Setup

```bash
npm install
npm start
```

App runs on http://localhost:4200 and expects the backend at the URL configured in
`src/environments/environment.ts`.

## Structure

- `src/app/pages/` — one folder per feature page
- `src/app/services/` — HTTP services
- `src/app/components/` — shared components (navbar)
- `src/app/guards/` — route guards
- `src/app/interceptors/` — HTTP interceptors (JWT)
- `src/environments/` — environment configuration

## Build

```bash
npm run build
```

Output goes to `dist/frontend/`.

## Notes

- Standalone components (no NgModules)
- JWT token is attached to outgoing requests by an HTTP interceptor
- Leaflet is used for the map view
