# STB Security

Gestion des agents de sécurité pour STB.

## Stack

- Frontend: Angular 21 (standalone components)
- Backend: Node.js + Express 5
- DB: PostgreSQL
- Auth: JWT

## Structure

```
backend/
  src/
    index.js          — API entry, CORS, routes
    config/db.js      — PostgreSQL connection pool
    middleware/
      auth.js         — JWT verification
      roles.js        — RBAC (numeric levels)
    routes/           — one file per entity
    scripts/          — seed + migrations
frontend/
  src/app/
    pages/            — one folder per page
    services/         — HTTP wrappers
    components/       — navbar
    guards/           — auth guard
    interceptors/     — token interceptor
```

## Roles

- `agent` (level 1) — profile, assignments, tickets
- `chef_equipe` (level 2) — manage team, pointage, reports
- `admin` (level 3) — manage everything

## Pages

| Route | Component | Role |
|-------|-----------|------|
| /login | LoginComponent | public |
| /dashboard | DashboardComponent | all |
| /agent-profile | AgentProfileComponent | all |
| /mes-affectations | AgentAffectationsComponent | all |
| /map | MapComponent | all |
| /tickets | TicketsComponent | all |
| /agents | AgentListComponent | chef, admin |
| /agents/new | AgentFormComponent | chef, admin |
| /agents/edit/:id | AgentFormComponent | chef, admin |
| /team-management | TeamManagementComponent | chef, admin |
| /affectations | AffectationListComponent | chef, admin |
| /pointage | PointageComponent | chef, admin |
| /rapports | RapportsComponent | chef, admin |
| /chef-tickets | ChefTicketsComponent | chef, admin |
| /sites | SiteListComponent | admin |
| /sites/new | SiteFormComponent | admin |
| /sites/edit/:id | SiteFormComponent | admin |
| /users | UsersComponent | admin |
| /admin-analytics | AdminAnalyticsComponent | admin |
| /admin-tickets | AdminTicketsComponent | admin |

## API

All routes prefixed with `/api/`:

- `auth` — login, me, change password, change role
- `agents` — CRUD (admin sees all, chef sees their site)
- `sites` — CRUD (admin only)
- `affectations` — CRUD
- `presences` — pointage (daily + bulk)
- `rapports` — reports (chef creates, admin validates)
- `demandes` — tickets (agent → chef → admin two-step approval)
- `users` — profile, own password

## Auth flow

1. `POST /api/auth/login` → returns JWT (includes id, email, role)
2. Token stored in localStorage
3. `authInterceptor` adds `Authorization: Bearer <token>` to every request
4. `AuthGuard` checks token presence + role from route data
5. On refresh: token is decoded locally for instant role access, then `/me` fetches full profile

## Key behaviors

- Agent creation auto-generates a user account (email = matricule@stb.tn, password = matricule)
- New agents are auto-assigned to their chef's sites for 3 months
- Demandes use a two-step workflow: chef approves first, then admin gives final approval
- Pointage supports both individual and bulk attendance recording
- One chef per site is enforced at the database level