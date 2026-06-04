# Deploying STB Security to DigitalOcean

This guide walks you through deploying the **STB Security** app (Angular frontend + Node.js/Express + PostgreSQL backend) to **DigitalOcean App Platform**, using a **DigitalOcean Managed PostgreSQL** database.

> **Estimated cost:** ~$5/mo (basic-xxs backend) + $15/mo (managed Postgres, db-s-1vcpu-1gb) = **~$20/mo**. Frontend is a static site (free hosting on App Platform). Add a custom domain if you want (free; you only pay for DNS if you use DigitalOcean's DNS).

---

## 0. What was prepared in this repo

| File | Why |
| --- | --- |
| `backend/package.json` | Added `npm start` script and `engines.node: ">=18"`. |
| `backend/.env.example` | Template for required env vars. |
| `frontend/src/environments/environment.prod.ts` | Production API URL (the App Platform backend URL). |
| `frontend/angular.json` | Production build now swaps in `environment.prod.ts`. |
| `.do/app.yaml` | App Platform spec (optional; you can also configure in the UI). |

---

## 1. Push your code to GitHub

If you haven't already, commit the new files and push:

```bash
git add .
git commit -m "chore: add DigitalOcean App Platform deployment config"
git push origin main
```

The repo is already configured as `soltan02/pfe` on GitHub, so a `git push` will work.

---

## 2. Create the Managed PostgreSQL database

1. Go to **https://cloud.digitalocean.com** and sign in.
2. In the left sidebar, click **Databases** → **Create Database**.
3. Choose:
   - **Engine:** PostgreSQL
   - **Version:** 16 (or latest)
   - **Datacenter:** `NYC1` (we used `nyc` in `app.yaml`; pick whatever is closest to your users — if you change the region, update the `region:` in `app.yaml`).
   - **Size:** **Basic — 1 GB / 1 vCPU** ($15/mo) is plenty for a PFE.
   - **Standby Node:** Off (dev only).
4. Name it `stb-db` and click **Create Database**. It takes ~3–5 minutes to provision.

### 2.a. Whitelist App Platform

Once the database is ready:

1. Go to the database's **Settings** tab → **Trusted Sources**.
2. Click **Add Trusted Source** → **Allow App Platform** (`apps`). This lets your App Platform components reach the DB.

### 2.b. Create the database and user

In the database's **Overview** tab you'll find a **Connection Details** panel. App Platform gives you a single pooled connection string. To create a clean database for the app:

1. Open the **Command Line** section of the database page and run:
   ```sql
   CREATE DATABASE stb_security;
   CREATE USER stb_app WITH PASSWORD '<a-strong-password>';
   GRANT ALL PRIVILEGES ON DATABASE stb_security TO stb_app;
   ```
   (Or use the **Users & Databases** tab to do this from the UI.)
2. From the same page, copy the **Connection String** (it looks like `postgresql://doadmin:…@stb-db-do-user-xxxxx-0.b.db.ondigitalocean.com:25060/defaultdb?sslmode=require`). You'll need this in step 3.

> The host name is what App Platform should reach. The `?sslmode=require` part is important — your `db.js` reads `DB_SSL=true` and sets `ssl: { rejectUnauthorized: false }`, so it's compatible.

---

## 3. Create the App Platform app

1. In the left sidebar, click **Apps** → **Create App**.
2. Pick **GitHub** as the source and authorize DigitalOcean to access your account.
3. Select the **`soltan02/pfe`** repository and the **`main`** branch.
4. **Autodeploy:** leave it on (every push to `main` will redeploy).

### 3.a. Add the backend component

Click **Add Component** → **Service** and configure:

| Field | Value |
| --- | --- |
| **Name** | `stb-backend` |
| **Source directory** | `backend` |
| **Build command** | `npm install` |
| **Run command** | `npm start` |
| **HTTP port** | `8080` |
| **Instance count** | 1 |
| **Instance size** | Basic — XXS ($5/mo) |

**Environment variables** (Settings → Environment Variables):

| Key | Value | Encrypt? |
| --- | --- | --- |
| `NODE_ENV` | `production` | No |
| `DB_SSL` | `true` | No |
| `DATABASE_URL` | the connection string from step 2 (replace the database name `defaultdb` with `stb_security`) | **Yes** |
| `JWT_SECRET` | a long random string (e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) | **Yes** |
| `FRONTEND_URL` | leave blank for now; we'll set it after the frontend is created | No |

**Health check:** set to `HTTP GET /` (the existing handler returns `{ "message": "STB API running" }`).

### 3.b. Add the frontend component

Click **Add Component** → **Static Site**:

| Field | Value |
| --- | --- |
| **Name** | `stb-frontend` |
| **Source directory** | `frontend` |
| **Build command** | `npm install && npm run build` |
| **Output directory** | `dist/frontend/browser` |
| **Index document** | `index.html` |
| **Error document** | `index.html` *(important for Angular client-side routing)* |

### 3.c. Routing

App Platform will assign each component a URL of the form `https://<name>-<app-id>.ondigitalocean.app`. By default everything is reachable at the root. We need the API to be reachable at `/api` from the browser.

In the component editor for `stb-backend`, add a **Route**:

- **Path:** `/api`
- **Preserve URL prefix:** **off** (so the backend's `app.use('/api/...', …)` keeps working as-is)

### 3.d. Review and create

1. Choose a **region** (use the same region as your database).
2. Pick a **plan**: the cheapest will be the **Basic** plan (already chosen for each component). Leave the **Database** section empty if you provisioned it manually in step 2.
3. Click **Create App**. The first build takes 5–10 minutes.

---

## 4. Wire the two halves together

After the first deploy finishes:

1. Copy the **frontend URL** (something like `https://stb-frontend-xxxxx.ondigitalocean.app`).
2. In the App Platform dashboard, open the `stb-backend` component → **Settings** → **Environment Variables**.
3. Edit `FRONTEND_URL` and paste the frontend URL.
4. The backend will redeploy automatically. (You could also do this in `app.yaml` and let the next git push redeploy.)

5. In `frontend/src/environments/environment.prod.ts`, set `apiUrl` to the **backend URL** (not the `/api` path — the path is already in the file). The file should look like:
   ```ts
   export const environment = {
     production: true,
     apiUrl: 'https://stb-backend-xxxxx.ondigitalocean.app/api'
   };
   ```
6. Commit and push:
   ```bash
   git add frontend/src/environments/environment.prod.ts
   git commit -m "chore: set prod API URL"
   git push
   ```
   App Platform will rebuild the frontend.

---

## 5. Initialize the database schema

The repo has migration/seed scripts in `backend/src/scripts/`. Run them against your managed database once.

Easiest method — open a one-off console:

1. In the App Platform dashboard, go to the `stb-backend` component → **Console** tab.
2. Run:
   ```bash
   node src/scripts/seed.js
   node src/scripts/seedSites.js
   node src/scripts/migrateDemandes.js
   node src/scripts/addChefIdToSites.js
   ```
3. If a script needs `DATABASE_URL` and `DB_SSL`, the env vars from the component are already injected.

Alternative: connect with `psql` from your local machine using the connection string from step 2:
```bash
set DATABASE_URL=postgresql://doadmin:…@…:25060/stb_security?sslmode=require
set DB_SSL=true
node backend/src/scripts/seed.js
```

---

## 6. Open the app and log in

1. Click the frontend URL in the App Platform dashboard (or copy it).
2. Log in with the credentials your seed script created (check `backend/src/scripts/seed.js` for the default admin user/password).
3. Done! 🎉

---

## 7. (Optional) Custom domain

1. In the App Platform dashboard → **Settings** → **Domains** → **Add Domain**.
2. Point a `CNAME` from `app.yourdomain.com` to the ondigitalocean.app URL.
3. DigitalOcean will issue a free Let's Encrypt certificate.
4. Update `FRONTEND_URL` (backend env) and `environment.prod.ts.apiUrl` to the new domain, commit, push.

---

## 8. Day-to-day workflow

```bash
# 1. Make changes locally
# 2. Test
cd backend && npm run dev      # terminal 1
cd frontend && npm start       # terminal 2

# 3. Commit and push
git add .
git commit -m "feat: …"
git push
# App Platform automatically rebuilds and redeploys.
```

Watch the build/deploy in the **Apps → stb-security → Activity** tab. Each push creates a deploy; you can roll back to any prior deploy from the UI.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Backend deploy fails with `Cannot find module 'pg'` | `npm install` didn't run — verify `build_command` is `npm install` and `source_dir` is `backend`. |
| Frontend loads but API calls fail with CORS | `FRONTEND_URL` env var on the backend doesn't match the actual frontend URL. |
| API calls return 404 | Confirm the `/api` route is set on the **backend** component and the frontend `apiUrl` ends with `/api`. |
| `Error: self-signed certificate` from `pg` | `DB_SSL=true` is missing, or the connection string is missing `?sslmode=require`. |
| Login works locally but not in prod | `JWT_SECRET` differs between local and prod — set a real one in App Platform. |
| App sleeps / is slow on first request | Free-tier isn't available on App Platform; the basic-xxs instance is always on. Upgrade to a larger size if you need more CPU/RAM. |

---

## Cost recap

| Item | Size | Cost |
| --- | --- | --- |
| Backend (App Platform) | basic-xxs | $5/mo |
| Frontend (App Platform static site) | — | $0 |
| Managed PostgreSQL | db-s-1vcpu-1gb | $15/mo |
| **Total** | | **~$20/mo** |

To cut costs further you can use the $6/mo basic Droplet for both Node and Postgres, but you give up managed backups and zero-config HTTPS. The setup above keeps server admin to a minimum.
