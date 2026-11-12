# 🌅 Kohort
### Make room for progress.

**Your space to study, connect, and get things done!**

🔗 **Live Website:** https://kohort-web.netlify.app/

Kohort is a student-focused platform built to make college life a little less chaotic. From managing assignments and daily tasks to chatting with friends and studying together, Kohort brings productivity and collaboration into one place.

Because keeping track of 27 things in your head was never a sustainable strategy. 💀

## ✨ What can you do with Kohort?

- 🔐 **Secure Login:** Sign up and log in with Firebase Authentication.
- 💬 **Real-Time Chat:** Have private and group conversations.
- 🟢 **Online Presence:** See who's around and available.
- 📚 **Study Rooms:** Create or join spaces to study together.
- ⏱️ **Focus Sessions:** Stay focused with individual and group study sessions.
- ✅ **Task Management:** Keep track of your daily to-dos.
- 📅 **Assignment Tracking:** Stay ahead of deadlines.
- 📊 **Personal Dashboard:** Get an overview of your tasks and productivity.

## 🛠️ Built With

| Part | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Node.js, Express.js |
| Database | TiDB Cloud (MySQL-compatible) |
| Authentication | Firebase Authentication |
| Real-Time Features | Firebase Firestore, Realtime Database |
| Frontend Hosting | Netlify |
| Backend Hosting | Render |

## 📂 Project Structure

```text
Kohort/
├── client/
│   ├── public/
│   ├── src/
│   ├── .env.example
│   └── package.json
│
├── server/
│   ├── src/
│   ├── .env.example
│   └── package.json
│
├── .gitignore
└── README.md
```

## 🚀 Run It Locally

Want to explore the code or run Kohort on your machine? Let's go!

### Prerequisites
- Node.js and npm
- Git
- A Firebase project
- A MySQL-compatible database

### 1. Clone the repository

```bash
git clone https://github.com/Pranavi-1125/Kohort.git
cd Kohort
```

### 2. Install dependencies

```bash
cd client
npm install

cd ../server
npm install
```

### 3. Set up environment variables

Create `.env` files inside both `client` and `server` using their respective `.env.example` files.

**Client (`client/.env`):**

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_URL=
```

**Server (`server/.env`):**

```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173

DB_HOST=
DB_PORT=4000
DB_USER=
DB_PASSWORD=
DB_NAME=kohort

FIREBASE_DATABASE_URL=
FIREBASE_SERVICE_ACCOUNT_JSON=
```

Fill in the values from your Firebase and database configurations. Keep credentials private!

### 4. Start the backend

```bash
cd server
npm start
```

### 5. Start the frontend

Open another terminal:

```bash
cd client
npm run dev
```

Open the local URL shown by Vite, usually:

```text
http://localhost:5173
```

And done! 🎉

## ☁️ Deployment

Kohort is deployed using:

- Netlify for the frontend
- Render for the backend
- TiDB Cloud for database hosting
- Firebase for authentication and real-time services

## 🔒 A Little Security Note

- Authentication is handled through Firebase.
- API requests use Firebase ID tokens.
- Sensitive configuration is stored in environment variables.
- Private credentials are excluded from version control.

## 💛 Built By

**Pranavi Mudradi**

Computer Science Engineering Student

[GitHub Profile](https://github.com/Pranavi-1125)

Built with curiosity, caffeine, and probably too many debugging sessions.

*Learning, building, and making room for progress. One feature at a time.* 🌱
