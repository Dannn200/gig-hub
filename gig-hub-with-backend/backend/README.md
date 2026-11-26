# Gig Hub — Backend API

Node.js + Express 5 + SQLite (`better-sqlite3`) REST API for the Gig Hub frontend. No database server to install.

## Quick start
```bash
cd backend
npm install
cp .env.example .env      # set JWT_SECRET, CORS_ORIGIN
npm run seed              # optional demo data → ayush@university.edu / Password123
npm run dev               # http://localhost:4000/api/health
npm test                  # 7 integration suites
```
Set `SERVE_FRONTEND=true` to also serve the HTML pages from the same port (only html/css/js/images are exposed; `/backend` is never served).

> **Hosting:** Netlify only hosts the static pages. Deploy this API to Render / Railway / Fly.io / a VPS (use a persistent disk for the SQLite file, or swap in Postgres), then add the Netlify URL to `CORS_ORIGIN`.

## Auth
`Authorization: Bearer <token>` (JWT, 1 day; 30 days with `remember: true`). Logout, password change and password reset revoke all earlier tokens.
Errors always look like `{ "error": { "code", "message", "details?" } }` (422 = validation, 401/403/404/409 as expected).

## Page → endpoint map
| Page | Endpoints |
|---|---|
| register.html | `POST /api/auth/register` `{name,email,college,password}` |
| login.html | `POST /api/auth/login` `{email,password,remember}` · `POST /api/auth/forgot-password` · `POST /api/auth/reset-password` |
| dashboard.html | `GET /api/dashboard` (metrics, wallet, recommended, unread count) · `POST /api/wallet/withdraw` |
| gigs.html | `GET /api/gigs?category=food&q=python&sort=newest&page=1` · `POST /api/gigs/:id/join` (food) · `POST /api/gigs/:id/accept` · `GET /api/gigs/:id` |
| post-gig.html | `POST /api/gigs` `{title,category,description,reward,location,date,time,spots?}` |
| history.html | `GET /api/history?status=&category=&from=&to=` · `GET /api/history/report.csv` |
| profile.html | `GET /api/users/me` · `PATCH /api/users/me` · `GET /api/users/:id` · `GET /api/users/:id/reviews` |
| notifications.html | `GET /api/notifications` · `POST /api/notifications/read-all` · `PATCH /api/notifications/:id/read` · `GET /api/notifications/unread-count` |
| log out links | `POST /api/auth/logout` |

## All endpoints
**Auth** `POST /auth/register|login|logout|forgot-password|reset-password` · `GET /auth/me`
**Users** `GET|PATCH|DELETE /users/me` · `PATCH /users/me/password` · `GET /users/:id` · `GET /users/:id/reviews`
**Gigs** `GET /gigs` · `GET /gigs/mine?role=posted|working|joined&status=active` · `POST /gigs` · `GET|PATCH|DELETE /gigs/:id` (DELETE = cancel)
`POST /gigs/:id/accept|abandon|complete|join|leave|reviews`
**Dashboard / Wallet / History / Notifications** as in the table above plus `GET /wallet`, `DELETE /notifications/:id`.

## Gig lifecycle
- **Skill / task / event / academic gigs:** `open` → *worker* `accept` → `in_progress` (pending earning created) → *poster* `complete` → `completed` (worker's wallet credited, notification sent) → both sides may leave a 1–5★ review. Worker may `abandon` (gig re-opens, hurts completion rate); poster may cancel via `DELETE`.
- **Food orders:** `spots` seats; others `join`/`leave` (atomic, no overbooking); poster `complete`s to close. Same-college students get a "New food gig nearby" notification.
- A background job (every 15 min) sends one "starts soon" reminder per user for gigs within 24h (`gig_reminders` table prevents repeats).

## Design notes / limits
- Trust score = 60% avg rating (no reviews ⇒ 80) + 40% completion rate.
- The wallet is a **ledger only**: there is no payment gateway, so posters are not charged and withdrawals stay `pending`. Integrate Razorpay/UPI payouts at the `TODO` in `routes/wallet.js`.
- Password-reset emails are logged to the console (token also returned outside production). Plug a mailer into `sendResetEmail` in `routes/auth.js`.
- Set `ALLOWED_EMAIL_DOMAINS` to restrict sign-up to your university's domains. Emails ending `.edu` / `.ac.xx` / `.edu.xx` are flagged "verified student" (no inbox verification yet).
- Security: bcrypt, helmet, CORS allow-list, rate limits (200/min API, 30/15 min auth), parameterised SQL, zod validation, LIKE-wildcard escaping, CSV formula-injection guard.

## Layout
```
src/  app.js server.js config.js db.js seed.js
      middleware/ auth error validate    routes/ auth users gigs dashboard history wallet notifications
      services/ notify stats serializers reminders    utils/
tests/api.test.js
```
