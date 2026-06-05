# STB Security — Architecture

## Project Overview

STB Security is a full-stack web application for managing security agents, sites, assignments, and reports for the Société Tunisienne de Banque. It provides role-based access for Administrators, Team Leaders (Chef d'Équipe), and Security Agents.

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | Angular 19 (standalone components)  |
| Backend     | Node.js / Express                   |
| Database    | PostgreSQL                          |
| Auth        | JWT (jsonwebtoken + bcryptjs)      |
| Maps        | Leaflet (OpenStreetMap tiles)       |

## Directory Structure

```
stb-security/
├── ARCHITECTURE.md
├── DEPLOY.md
├── README.md
├── backend/
│   ├── src/
│   │   ├── index.js              # Express entry, CORS, routes
│   │   ├── config/
│   │   │   └── db.js             # PostgreSQL pool
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT verify
│   │   │   └── roles.js          # Role-based guards
│   │   ├── routes/
│   │   │   ├── auth.js           # Login, /me, password mgmt
│   │   │   ├── agents.js         # Agent CRUD
│   │   │   ├── sites.js          # Site CRUD
│   │   │   ├── affectations.js   # Assignment CRUD
│   │   │   ├── presences.js      # Attendance
│   │   │   ├── rapports.js       # Reports
│   │   │   ├── demandes.js       # Support tickets
│   │   │   ├── users.js          # User profile
│   │   │   ├── support.js        # Contact support
│   │   │   └── upload.js         # Avatar upload
│   │   └── scripts/              # Seed data
│   ├── uploads/avatars/          # Uploaded profile pictures
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   └── navbar/       # Navigation bar (all roles)
│   │   │   ├── pages/
│   │   │   │   ├── login/        # Shared login page
│   │   │   │   ├── dashboard/    # Role-based dashboards
│   │   │   │   ├── map/          # Sites map (admin)
│   │   │   │   ├── agents/       # Agent list + form
│   │   │   │   ├── sites/        # Site list + form
│   │   │   │   ├── affectations/ # Assignments
│   │   │   │   ├── agent-affectations/ # Agent's assignments
│   │   │   │   ├── agent-profile/      # Profile + avatar
│   │   │   │   ├── team-management/    # Chef's team view
│   │   │   │   ├── pointage/     # Attendance
│   │   │   │   ├── rapports/     # Reports
│   │   │   │   ├── tickets/      # Agent tickets
│   │   │   │   ├── chef-tickets/ # Team tickets
│   │   │   │   ├── admin-tickets/ # All tickets (admin)
│   │   │   │   ├── contact-support/ # Contact support form
│   │   │   │   ├── admin-analytics/  # Admin analytics
│   │   │   │   └── users/        # User management (admin)
│   │   │   ├── services/
│   │   │   │   ├── auth.ts       # Auth state + login
│   │   │   │   ├── agents.ts     # Agent API
│   │   │   │   ├── sites.ts      # Site API
│   │   │   │   ├── affectations.ts # Assignment API
│   │   │   │   └── support.ts    # Contact support API
│   │   │   ├── guards/
│   │   │   │   └── auth-guard.ts # Route protection
│   │   │   ├── interceptors/
│   │   │   │   └── auth-interceptor.ts # JWT attachment
│   │   │   ├── app.ts            # Root component
│   │   │   ├── app.routes.ts     # Route definitions
│   │   │   └── app.config.ts     # Angular providers
│   │   ├── assets/
│   │   │   ├── stb-logo.png      # STB logo
│   │   │   └── default-avatar.png # Default profile picture
│   │   ├── environments/
│   │   ├── main.ts
│   │   └── styles.css
│   ├── angular.json
│   └── package.json
└── .gitignore
```

## Database Schema

### `users`
| Column      | Type         | Notes                |
|-------------|-------------|----------------------|
| id          | SERIAL PK   |                      |
| nom         | VARCHAR     | Full name            |
| email       | VARCHAR     | Login credential     |
| password    | VARCHAR     | bcrypt hash          |
| role        | VARCHAR     | agent/chef_equipe/admin |
| agent_id    | INTEGER     | FK → agents.id       |
| avatar_url  | TEXT        | Profile picture path |

### `agents`
| Column     | Type       | Notes            |
|------------|-----------|------------------|
| id         | SERIAL PK |                  |
| nom        | VARCHAR   | Full name        |
| prenom     | VARCHAR   | First name       |
| telephone  | VARCHAR   | Phone            |
| adresse    | VARCHAR   | Address          |
| statut     | VARCHAR   | actif/inactif    |
| chef_id    | INTEGER   | FK → users.id    |

### `sites`
| Column  | Type       | Notes           |
|---------|-----------|-----------------|
| id      | SERIAL PK |                 |
| nom     | VARCHAR   | Site name        |
| adresse | VARCHAR   | Address          |
| ville   | VARCHAR   | City             |
| statut  | VARCHAR   | actif/inactif    |
| chef_id | INTEGER   | FK → users.id    |

### `affectations`
| Column     | Type       | Notes              |
|-----------|-----------|--------------------|
| id         | SERIAL PK |                    |
| agent_id   | INTEGER   | FK → agents.id     |
| site_id    | INTEGER   | FK → sites.id      |
| date_debut | DATE      | Start date         |
| date_fin   | DATE      | End date           |
| statut     | VARCHAR   | en cours/completed |
| chef_id    | INTEGER   | FK → users.id      |

### `presences`
| Column     | Type       | Notes            |
|-----------|-----------|------------------|
| id         | SERIAL PK |                  |
| agent_id   | INTEGER   | FK → agents.id   |
| site_id    | INTEGER   | FK → sites.id    |
| date       | DATE      | Attendance date  |
| heure_arrivee | TIME   | Check-in time    |
| heure_depart  | TIME   | Check-out time   |

### `demandes`
| Column        | Type       | Notes              |
|--------------|-----------|--------------------|
| id            | SERIAL PK |                    |
| chef_id       | INTEGER   | FK → users.id      |
| type          | VARCHAR   | support / other    |
| description   | TEXT      | Message content    |
| date_creation | TIMESTAMP | Created at         |

## Role Permissions

| Feature                  | Agent | Chef d'Équipe | Admin |
|--------------------------|-------|---------------|-------|
| View Dashboard           | ✅    | ✅            | ✅    |
| View Assignments         | ✅    | ✅            | ✅    |
| View/Edit Profile        | ✅    | ✅            | ✅    |
| Contact Support          | ✅    | ✅            | ❌    |
| Manage Team              | ❌    | ✅            | ✅    |
| View Attendance          | ❌    | ✅            | ✅    |
| Create Reports           | ❌    | ✅            | ❌    |
| Manage Agents            | ❌    | ✅            | ✅    |
| Manage Sites             | ❌    | ❌            | ✅    |
| View All Reports         | ❌    | ❌            | ✅    |
| Manage Users             | ❌    | ❌            | ✅    |
| View Analytics           | ❌    | ❌            | ✅    |

## API Endpoints

| Method | Path                           | Role       | Description              |
|--------|-------------------------------|------------|--------------------------|
| POST   | /api/auth/login               | Public     | Login                    |
| GET    | /api/auth/me                  | Any       | Current user profile     |
| GET    | /api/agents                   | Chef+     | List agents              |
| GET    | /api/sites                    | Chef+     | List sites               |
| GET    | /api/sites/mine               | Agent     | Agent's assigned sites   |
| GET    | /api/affectations             | Chef+     | List assignments         |
| GET    | /api/affectations/mes-affectations | Agent | Agent's assignments      |
| GET    | /api/presences                | Chef+     | List attendance          |
| GET    | /api/rapports                 | Chef      | Chef's reports           |
| GET    | /api/rapports/admin/all       | Admin     | All reports              |
| POST   | /api/rapports                 | Chef      | Create report            |
| PUT    | /api/rapports/:id/validate    | Admin     | Approve report           |
| GET    | /api/demandes                 | Admin     | List support requests    |
| POST   | /api/support                  | Agent+    | Send support message     |
| POST   | /api/upload/avatar            | Any       | Upload profile picture   |
| GET    | /api/dashboard/stats          | Any       | Dashboard counters       |
| PUT    | /api/users/profile            | Any       | Update own profile       |
| PUT    | /api/users/change-own-password | Any      | Change own password      |

## How to Run

### Backend
```bash
cd backend
cp .env.example .env   # Edit with your PostgreSQL credentials
npm install
node src/index.js      # Starts on port 3000
```

### Frontend
```bash
cd frontend
npm install
ng serve --port 4200  # Starts on port 4200