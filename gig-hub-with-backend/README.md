# Gig Hub — Full Stack (Frontend + Backend + Google OAuth)

Gig Hub is a campus gig and food-sharing marketplace for university students.

## Quick Start (Full Stack)

### 1. Install & Run Backend
```bash
cd backend
npm install
npm run seed      # Populates SQLite DB with demo student accounts & gigs
npm start         # Runs API & serves frontend on http://localhost:4000
```

Open `http://localhost:4000` in your browser.

- **Demo Student Account:** `ayush@university.edu` / `Password123`
- **Google Sign-in:** Click **Continue with Google** on `login.html` (supports real Google OAuth or instant local interactive demo sign-in).

### 2. Architecture & Site Type
- **Is this a static site or a dynamic site?**
  - **Originally:** The project was built as a **static site** (JAMstack client-side frontend storing state in browser `localStorage`).
  - **Now (with Backend Integrated):** It is a **dynamic web application** (Decoupled Client-Server Dynamic Architecture: responsive HTML5/CSS/Vanilla JS frontend consuming a dynamic Node.js/Express REST API backed by a persistent SQLite database with JWT authentication, real-time spot decrementing, and transactions).

### 3. Google OAuth Setup
- In `backend/.env`:
  ```env
  GOOGLE_CLIENT_ID=your_client_id_from_google_cloud_console
  GOOGLE_CLIENT_SECRET=your_client_secret
  ```
- If left empty, the login page will offer an interactive development/demo Google sign-in so you can test authentication without needing Google Cloud credentials right away.

### 4. Running Integration Tests
```bash
cd backend
npm test
```
All 7 integration test suites verify authentication, Google OAuth, gigs lifecycle, wallet withdrawals, and notifications.

