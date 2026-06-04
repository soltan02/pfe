# STB Security

PFE project — gestion des agents de sécurité pour STB.

## Stack

- Frontend: Angular (standalone components)
- Backend: Node.js + Express
- DB: PostgreSQL
- Auth: JWT

## Structure

```
backend/
  src/
    index.js          — entry point, routes
    config/db.js      — PostgreSQL connection
    middleware/
      auth.js         — JWT verification
      roles.js        — basic RBAC
    routes/           — one file per entity, handlers inline
    scripts/          — seed, migrations
frontend/
  src/app/
    pages/            — one folder per page
    services/         — HTTP calls
    components/       — navbar
    guards/           — auth guard
    interceptors/     — token interceptor
```

## Roles

- `agent` — view profile, assignments, create requests
- `chef_equipe` — manage team, pointage, reports
- `admin` — manage everything (sites, users, agents)

`roles.js` compares numeric levels: agent=1, chef=2, admin=3. Higher levels include lower-level permissions.

## Pages

| Route | Component | Role |
|-------|-----------|------|
| /login | LoginComponent | public |
| /dashboard | DashboardComponent | all |
| /agents | AgentListComponent | chef, admin |
| /agents/new | AgentFormComponent | chef, admin |
| /agents/edit/:id | AgentFormComponent | chef, admin |
| /sites | SiteListComponent | admin |
| /sites/new | SiteFormComponent | admin |
| /sites/edit/:id | SiteFormComponent | admin |
| /users | UsersComponent | admin |
| /team-management | TeamManagementComponent | chef, admin |
| /affectations | AffectationListComponent | chef, admin |
| /pointage | PointageComponent | chef, admin |
| /rapports | RapportsComponent | chef, admin |
| /admin-analytics | AdminAnalyticsComponent | admin |
| /map | MapComponent | all |
| /mes-affectations | AgentAffectationsComponent | all |
| /agent-profile | AgentProfileComponent | all |
| /tickets | TicketsComponent | all |
| /chef-tickets | ChefTicketsComponent | chef, admin |
| /admin-tickets | AdminTicketsComponent | admin |

## API

All routes are prefixed with `/api/`:

- `auth` — login, me, change password
- `agents` — CRUD
- `sites` — CRUD (admin only)
- `affectations` — CRUD
- `presences` — pointage
- `rapports` — reports
- `demandes` — tickets/requests
- `users` — profile, password

## Auth flow

1. Login → `POST /api/auth/login` → returns JWT
2. Token stored in `localStorage`
3. Interceptor adds `Authorization: Bearer <token>` to every request
4. `AuthGuard` checks for the presence of a token
5. On refresh: `AuthService` decodes the token locally (role is available immediately) and calls `fetchMe()` for full user data

## Notes

- Components are standalone (no NgModules)
- Services use `providedIn: 'root'`
- The dashboard shell switches by role using `*ngIf` blocks
- DB seed and migration scripts live in `backend/src/scripts/`
