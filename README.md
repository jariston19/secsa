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

- App: http://localhost:5173
- API: http://localhost:3001

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
