# STB Security

PFE project — gestion des agents de sécurité pour STB.

## Stack

- Frontend: Angular 19 (standalone components)
- Backend: Node.js + Express
- DB: PostgreSQL
- Auth: JWT

## Structure

```
backend/
  src/
    index.js          — point d'entrée, routes
    config/db.js      — connexion PostgreSQL
    middleware/
      auth.js         — vérif JWT
      roles.js        — RBAC basique
    routes/           — chaque entité a son fichier
    controllers/      — logique métier (sites, affectations)
    scripts/          — seed, migrations
frontend/
  src/app/
    pages/            — une page par dossier
    services/         — appels HTTP
    components/       — navbar
    guards/           — auth guard
    interceptors/     — token interceptor
```

## Rôles

- `agent` — peut voir son profil, ses affectations, créer des demandes
- `chef_equipe` — gère son équipe, pointage, rapports
- `admin` — tout gérer (sites, users, agents)

Le middleware roles.js compare des niveaux: agent=1, chef=2, admin=3. Donc admin peut tout faire.

## Pages

| Route | Composant | Rôle |
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

Routes sous `/api/`:
- auth (login, me, change password)
- agents (CRUD)
- sites (CRUD, admin only)
- affectations (CRUD)
- presences (pointage)
- rapports (reports)
- demandes (tickets/requests)
- users (profile, password)

## Auth flow

1. Login → POST /api/auth/login → reçoit JWT
2. Token stocké dans localStorage
3. Interceptor ajoute `Authorization: Bearer <token>` à chaque requête
4. AuthGuard vérifie la présence du token
5. Sur refresh: AuthService decode token localement (rôle dispo immédiatement) + fetchMe() pour données complètes

## Notes

- Les composants sont standalone (pas de NgModules)
- Les services sont providedIn: 'root'
- Dashboard utilise ngSwitch pour afficher le bon composant selon le rôle
- Les scripts de seed sont dans backend/src/scripts/