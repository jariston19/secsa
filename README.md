# SECSA — MCQ Diagnostic Exam Platform

Initial working scaffold for the SECSA comprehensive/diagnostic exam system.

## Features (MVP)

- **Students**: login, take deployed exam, randomized order, score/percentage/pass-fail (75%)
- **Teachers**: subjects, optional topics, questions with images, question sets, deploy diagnostic/retake pools
- **Superadmin**: add users, analytics overview, retake approvals
- **Retakes**: max 2, teacher/superadmin approval, separate retake question pool
- **Year levels**: student `yearLevel` (e.g. `2` = incoming 2nd year)

## Quick start (development)

```bash
npm install
cd backend && npx prisma migrate dev --name init && npm run db:seed
cd .. && npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Superadmin | admin@secsa.local | password123 |
| Teacher | teacher@secsa.local | password123 |
| Student | student@secsa.local | password123 |
| QA Student (unlimited takes) | qa@secsa.local | password123 |

## Docker

Works on macOS, Linux, and Windows (Docker Desktop with WSL2 recommended).

```bash
docker compose up --build
```

Or:

```bash
npm run docker:up
```

- App (HTTPS): **https://localhost:5173**
- On your LAN: **https://<server-ip>:5173** (same port as before, now HTTPS)
- API is proxied at `/api` through the frontend — you do not need port 3001 on client machines.

Docker runs database migrations on startup, but it does **not** load demo seed data by default.
To intentionally load the demo accounts/content, set `SEED_ON_START=true` for the backend service.

### HTTPS in Docker

A **Caddy** reverse proxy terminates TLS and forwards to the frontend container.

| Scenario | Setup |
|----------|--------|
| **Lab / LAN (no domain)** | Default. Caddy uses an internal certificate. Students open `https://<server-ip>:5173` and accept the browser security warning once (Advanced → Proceed). This enables secure-context features such as in-app fullscreen. |
| **Production (public domain)** | Edit `docker/caddy/Caddyfile` to use your domain (see comments in that file). Point DNS to the server. Caddy obtains a Let's Encrypt certificate automatically. |

HTTP on port **80** redirects to **https://…:5173**.

Optional `.env` in the repo root:

```env
SEED_ON_START=false
```

To serve HTTPS on port 443 instead of 5173, change the Caddy `ports` in `docker-compose.yml` to `"443:443"` and update the `:80` redirect in `docker/caddy/Caddyfile`.

If seed data already exists in your Docker database, rebuilding the image will not remove it because
SQLite data is kept in the `secsa-data` Docker volume. To wipe that Docker database and start fresh:

```bash
docker compose down -v
docker compose up --build
```

Only run `docker compose down -v` if you are okay deleting the Docker database volume.

### Windows notes

- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and enable the **WSL2** backend.
- Run commands from the repo root in **PowerShell**, **CMD**, or a WSL terminal — not Git Bash with mixed path mounts unless you know the tradeoffs.
- If a build fails after copying files from another machine, run `docker compose build --no-cache` so Linux dependencies (for example `sharp`) are installed inside the image instead of reusing host `node_modules`.
- Keep Docker-related files on LF line endings. This repo uses `.gitattributes` for that; if you still see `sh\r` errors, run `git add --renormalize .` and rebuild.

Images target `linux/amd64` so builds are consistent across Intel/ARM laptops and Windows hosts.

## Project structure

```
secsa/
├── backend/     Fastify API + Prisma + SQLite
├── frontend/    React + Vite PWA
└── docker-compose.yml
```

## Next steps

- Multi-subject question set builder UI
- Richer analytics charts
- Offline exam caching in PWA service worker
- Bulk student import
