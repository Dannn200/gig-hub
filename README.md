# Gig Hub — Campus Gig & Food-Sharing Marketplace

> A modern campus platform connecting university students to share food orders, collaborate on tasks, offer skills, and earn rewards within their university community.

## 🌟 Highlights
- **Decoupled Architecture:** Static Netlify-ready frontend + Node.js / Express 5 REST API + SQLite database.
- **Authentication:** University email credentials, password hashing with bcrypt, JWT sessions, and **Google OAuth** integration.
- **Campus Marketplace:** Filter by Category (Food, Skills, Tasks, Events, Academic), search, sort by reward, and view detailed gig pages.
- **Food Sharing:** Pooled cafeteria food orders with atomic spot reservations and pickup tokens.
- **Student Dashboard & Wallet:** Track earnings, view task recommendations, review past activity, and request balance withdrawals.
- **Responsive UI:** Custom modern design system built with vanilla HTML5, CSS3 (Plus Jakarta Sans & Fraunces), and responsive cards.

---

## 📁 Repository Structure
```
├── gig-hub-with-backend/       # Full-stack integrated version
│   ├── backend/                # REST API (Express 5, SQLite, JWT, Zod, Helmet)
│   │   ├── src/                # API routes, middleware, db schema, services
│   │   ├── tests/              # Automated integration tests
│   │   └── .env.example        # Environment variables template
│   ├── css/                    # Shared styling system
│   ├── js/                     # API client & UI controller
│   └── *.html                  # Marketplace & dashboard pages
└── gig-hub/                    # Standalone Netlify-deployable frontend
```

---

## 🚀 Quick Start

### 1. Start the Backend API & Frontend Server
```bash
cd gig-hub-with-backend/backend
npm install
npm run seed      # Creates sample database with demo students & gigs
npm start         # Starts server on http://localhost:4000
```

Open `http://localhost:4000` in your browser.

- **Demo Student Credentials:**
  - **Email:** `ayush@university.edu`
  - **Password:** `Password123`
- **Google Sign-In:** Click **"Continue with Google"** on the login page (supports real Google OAuth or interactive local demo sign-in).

### 2. Run Integration Tests
```bash
cd gig-hub-with-backend/backend
npm test
```
All 7 integration test suites verify health checks, authentication, Google OAuth, gigs lifecycle, wallet withdrawals, and notifications.

---

## 🔒 Google OAuth Setup (Optional)
To use your real Google Cloud OAuth credentials:
1. In the [Google Cloud Console](https://console.cloud.google.com/), create an **OAuth 2.0 Client ID** (Web application).
2. Add `http://localhost:4000` (and your Netlify URL) to **Authorized JavaScript origins**.
3. Add the Client ID to `gig-hub-with-backend/backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```
4. Restart the server. Google Sign-In will automatically use the Google popup.
