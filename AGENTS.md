## Learned User Preferences

- Default UI theme is light mode.
- Prefer an iOS-inspired aesthetic with soft modal open/close animations.
- Students see Easy / Medium / Hard on exams; Bloom's taxonomy is teacher-facing for authoring and deeper analytics.
- Prefer Google Forms-style question encoding: add rows dynamically and save from a separate tab.
- Prefer one-question-at-a-time exam flow for accurate per-question timing (not scrollable all-at-once MCQ).
- Modals should use fixed dimensions with scrollable inner content; block background page scroll while open.
- Superadmin should have all teacher capabilities in addition to admin functions.
- Exclude QA (`qaUnlimited`) students from analytics counts.
- When a UI change is wrong, ask to undo/roll back rather than layering fixes on top.
- Only create git commits or push when explicitly requested.
- Prefer slide-by-slide markdown outlines over native PPT when the agent cannot generate `.pptx`.
- Teacher and student UIs should remain responsive for mobile/LAN access.

## Learned Workspace Facts

- SECSA is an MCQ comprehensive exam platform for ~20–30 teachers and 500+ students.
- Stack: React/Vite frontend, Fastify + Prisma backend, SQLite; deployable via Docker Compose.
- Pass threshold is 75% (`score / total items × 100`); retakes require teacher/superadmin approval with a limit of 2.
- Year level maps to incoming cohort (e.g. year 2 = incoming 2nd year); comprehensive exams test the previous year's subjects.
- Subjects use course code + title (e.g. ACEE 106 Electromagnetics); topics are optional but enable finer exam design and analytics.
- Program courses: Civil Engineering, Mechanical Engineering, Electrical Engineering, Information Technology, Architecture; pools filter by year + program course.
- Three exam types: COMPREHENSIVE (main retention exam), DIAGNOSTIC (incoming year-1 readiness from senior high), RETAKE (separate retake pool).
- Questions tag difficulty (EASY/MEDIUM/HARD) and Bloom level (`bloomLevel`: REMEMBER through CREATE); question sets can pin deployed exam pools.
- Only one deployed question set per type per year + program course at a time.
- Analytics uses three lenses: Group/Year, Per Student, Per Question; primary UI is superadmin AdminDashboard → Analytics.
- Question authoring guidelines and analytics chart mapping live in `docs/question-guidelines-and-analytics-outline.md`.
- Default dev: `npm run dev` from repo root; demo logins include `admin@secsa.local` and `teacher@secsa.local` (password `password123`).
