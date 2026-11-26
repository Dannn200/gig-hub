# Gig Hub — Netlify-ready frontend (v2)

## Deploy
1. Extract this ZIP.
2. Drag the extracted `gig-hub` folder into Netlify's manual deploy area (app.netlify.com/drop), or upload the ZIP.
3. Netlify serves `index.html` as the homepage and `404.html` for unknown URLs.

## Pages
- index.html — landing page (hero, trending gigs, how it works, testimonials)
- login.html / register.html — authentication screens
- dashboard.html — student dashboard with suggestions and your activity
- gigs.html — marketplace with live search, category filters, sorting, saved gigs and suggestions
- gig-details.html?id=… — full gig page with apply flow and similar gigs
- post-gig.html — post a gig with live preview, smart suggestions and quality checklist
- post-success.html — confirmation page shown after publishing a gig
- join-order.html?id=… — checkout for joining a shared food order
- join-success.html — order confirmation with pickup token and suggestions
- history.html, profile.html, notifications.html — as before, now with live activity
- 404.html — not-found page
- css/style.css — shared design system · js/data.js — sample data · js/app.js — behaviour

## How data works
This frontend is Netlify-ready and connects to the Gig Hub Node.js REST API (`http://localhost:4000/api` or relative `/api`).
When the backend is active, user authentication (including Google OAuth), gigs, orders, history, and notifications are stored securely in the database.
If the backend is not running, it gracefully falls back to local demo mode (`localStorage`) so the entire UI remains functional.

To run the backend, navigate to `../gig-hub-with-backend/backend` and run `npm start`.
