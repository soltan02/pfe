# STB Security - Frontend

PFE project. Frontend Angular pour la gestion de sécurité STB.

## Setup

```bash
npm install
ng serve
```

## Structure

- `src/app/pages/` - les pages (dashboard, agents, sites, etc.)
- `src/app/services/` - services API
- `src/app/components/` - components partagés (navbar)
- `src/environments/` - config API URL

## Build

```bash
ng build
```

Les fichiers de build dans `dist/frontend/`.

## Notes

- standalone components (pas de NgModules)
- interceptor pour le token JWT automatique
- Leaflet pour la map