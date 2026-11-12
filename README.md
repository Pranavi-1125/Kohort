# Kohort — Make room for progress

An academic productivity and collaboration platform: planner, assignment tracker, solo and group focus sessions, study rooms and real-time chat.

| Layer | Tech |
|---|---|
| Client | React 19 (Vite), React Router, Context API, plain CSS ("Morning Light" theme, DM Sans + Inter) |
| API | Node.js, Express, REST, `firebase-admin` token verification |
| Structured data | MySQL (users, tasks, assignments, rooms, memberships, invites, conversations, focus history, group sessions) |
| Realtime | Cloud Firestore (chat messages, shared group-timer state), Realtime Database (online/offline presence) |
| Auth | Firebase Authentication (email + password) |

```
kohort/
├── client/            React app
│   └── src/{pages,components,context,hooks,lib}
├── server/            Express API
│   ├── sql/schema.sql
│   └── src/{routes,middleware,config,utils}
├── firestore.rules    Firestore security rules
├── database.rules.json  Realtime Database rules
└── firebase.json
```

## How the pieces fit together

* **Identity**: the browser signs in with Firebase Auth and sends its ID token to the API (`Authorization: Bearer …`). The API verifies it and maps it to a MySQL `users` row (created on first request).
* **Authorization**: every REST route scopes data to the authenticated user (tasks and assignments by owner; rooms, conversations and sessions by membership; private rooms are invisible to non-members).
* **Realtime access control**: membership changes go through the API, which mirrors a `memberUids` list into Firestore with the Admin SDK. Firestore rules only let those UIDs read or post messages. Clients can never write membership or timer state.
* **Synchronised group timer**: the host's action (start / pause / resume / reset) hits the API, which stores an absolute `endsAt` timestamp and mirrors it to Firestore. Every participant listens to that document and computes `endsAt − (now + serverOffset)`, so everyone sees the same countdown. When it reaches zero any member reports completion; the server verifies the time has really elapsed, finishes the session once, and records a focus entry for each member.
* **Presence**: each client writes `status/{uid}` in Realtime Database with an `onDisconnect` hook.

## Setup

### 1. Prerequisites
Node.js 20+, MySQL 8+ (or MariaDB 10.6+), a Firebase project.

### 2. Firebase project
1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method**: enable *Email/Password*.
3. **Firestore Database**: create a database (production mode).
4. **Realtime Database**: create a database; copy its URL.
5. **Project settings → General → Your apps**: add a *Web app* and copy its config values.
6. **Project settings → Service accounts → Generate new private key**: save the JSON as `server/serviceAccountKey.json` (it is git-ignored).
7. Deploy the rules (either paste them in the console or use the CLI):
   ```bash
   npm i -g firebase-tools && firebase login
   firebase use --add            # pick your project
   firebase deploy --only firestore:rules,database
   ```

### 3. Database
```bash
cd server
cp .env.example .env      # fill in DB_* values and Firebase paths
npm install
npm run db:init           # creates the database and tables from sql/schema.sql
npm run dev               # API on http://localhost:5000
```

### 4. Client
```bash
cd client
cp .env.example .env      # paste the Firebase web config
npm install
npm run dev               # http://localhost:5173 (proxies /api to :5000)
```
Register two accounts (use a second browser profile) to try chat, rooms, presence and group focus.

## Environment variables

**server/.env**

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 5000) |
| `CLIENT_ORIGIN` | Allowed browser origin(s) for CORS, comma-separated |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the Firebase service-account JSON |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Alternative: the full JSON as a single-line string (for hosts without file storage) |
| `FIREBASE_DATABASE_URL` | Realtime Database URL |

**client/.env**

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_DATABASE_URL` | Firebase web config |
| `VITE_API_URL` | API base URL in production (e.g. `https://api.example.com/api`). Leave unset in development. |

`GET /api/health` reports whether the database and Firebase are configured.

## Deployment

**API** (Render, Railway, Fly.io, a VPS…): run `npm install && npm start` in `server/`. Provide a managed MySQL (PlanetScale-compatible MySQL, Railway MySQL, RDS, etc.), run `npm run db:init` once against it, and set the env vars above. Set `CLIENT_ORIGIN` to your deployed client URL. Put `FIREBASE_SERVICE_ACCOUNT_JSON` in the host's secret store rather than committing a key file.

**Client** (Netlify, Vercel, Firebase Hosting, Cloudflare Pages): set the `VITE_*` variables, run `npm run build`, publish `client/dist`. SPA fallbacks are included (`public/_redirects` for Netlify, `vercel.json` for Vercel; for Firebase Hosting add a rewrite of `**` to `/index.html`). In Firebase **Authentication → Settings → Authorized domains**, add your client domain.

## Features at a glance
* **Dashboard**: today's tasks, deadlines, productivity (focus minutes, streak, 7-day chart), quick solo/group focus, recent chats, your rooms, classmates online.
* **Planner**: month calendar with task dots, add/edit/delete, priority, due time, status and date filters, overdue indicators.
* **Assignments**: course, due date, status (not started / in progress / completed), overdue highlighting, quick completion, overview stats.
* **Focus**: customizable focus/break timer that survives page navigation, session summary, saved history. Group sessions with host-controlled shared timer, presence and chat.
* **Study rooms**: public discovery, join/leave, private rooms with invitations (accept/decline), member list with presence, room chat, owner delete / ownership transfer.
* **Messages**: direct and group chats, realtime delivery, timestamps, online indicators, group rename / add / remove / leave.
* **Profile**: name, picture URL, university, major, year, bio.

## Security notes
* All API routes except `/api/health` require a verified Firebase ID token; input is validated server-side; helmet and rate limiting are enabled.
* Presence (`status/{uid}`) is readable by any signed-in user so classmates can see who is online; only the owner can write their own status.
* Profile pictures are URLs (no file uploads), to avoid adding a storage service.

## Known limitations
* No password-less/OAuth sign-in; email + password only.
* Tasks have no recurrence; the calendar is a month view.
* Notifications are in-app only (no push/email).
