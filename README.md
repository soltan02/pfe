# STB Security

PFE project — security agent management for STB.

## Stack

- Frontend: Angular (standalone components)
- Backend: Node.js + Express
- DB: PostgreSQL
- Auth: JWT

## Layout

```
backend/   Express API + PostgreSQL connection
frontend/  Angular SPA
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full structure, routes, and roles.

## Local development

### Backend

```bash
cd backend
npm install
# create a .env file with DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET
node src/scripts/seed.js   # optional, seeds initial data
npm run dev                # starts Express on http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm start                  # ng serve on http://localhost:4200
```

The frontend reads `frontend/src/environments/environment.ts` for the API URL.
