# My Social Messenger

A full-stack social network application with real-time chat, groups, events, and notifications. The project consists of three parts: a **Go backend**, a **Next.js frontend**, and an optional **Electron desktop app**.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Getting Started](#getting-started)
  - [Using Docker (recommended)](#using-docker-recommended)
  - [Running Locally](#running-locally)
- [Electron Desktop App](#electron-desktop-app)
- [Environment Variables](#environment-variables)

---

## Architecture

```
┌──────────────────────┐     HTTP / WebSocket      ┌─────────────────────┐
│   Next.js Frontend   │ ◄────────────────────────► │    Go Backend       │
│   (Port 3000)        │                            │    (Port 8080/8081) │
└──────────────────────┘                            └──────────┬──────────┘
                                                               │
┌──────────────────────┐                            ┌──────────▼──────────┐
│  Electron Desktop    │ ◄──────────────────────────│   SQLite Database   │
│  App (optional)      │         REST API           │   + Migrations      │
└──────────────────────┘                            └─────────────────────┘
```

---

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Backend      | Go 1.21, `net/http`, Gorilla WebSocket |
| Database     | SQLite 3 (`mattn/go-sqlite3`)       |
| Migrations   | `golang-migrate/migrate`            |
| Auth         | Session-based (UUID tokens, bcrypt) |
| Frontend     | Next.js 16, React 18, TypeScript    |
| Desktop      | Electron 29, electron-builder       |
| Container    | Docker, Docker Compose              |

---

## Features

- **Authentication** — register, login, logout with session cookies
- **User Profiles** — public / private profiles, avatars, about me, date of birth
- **Follow System** — follow / unfollow users; private profiles require approval
- **Posts & Comments** — create posts (with image upload), add comments, control visibility (public / followers / selected users)
- **Groups** — create groups, invite members, request to join, manage membership
- **Events** — create events inside groups, RSVP (going / not going)
- **Real-time Chat** — private direct messages and group chat via WebSocket
- **Notifications** — follow requests, group invitations, event updates — all delivered in real time
- **Online Presence** — see which users are currently online
- **Image Uploads** — upload and serve profile avatars and post images
- **Desktop App** — Electron wrapper for macOS, Windows, and Linux

---

## Project Structure

```
social-network/
├── docker-compose.yml
├── backend/
│   ├── server.go                  # Entry point, routing
│   ├── go.mod
│   ├── Dockerfile
│   └── pkg/
│       ├── db/
│       │   ├── sqlite/sqlite.go   # DB connection + migration runner
│       │   └── migrations/sqlite/ # SQL migration files (up/down)
│       ├── handlers/              # HTTP handlers
│       │   ├── auth.go
│       │   ├── chat.go
│       │   ├── followers.go
│       │   ├── groups.go
│       │   ├── notifications.go
│       │   ├── posts.go
│       │   ├── profile.go
│       │   └── upload.go
│       ├── middleware/
│       │   └── auth.go            # Session auth middleware + CORS
│       ├── models/                # Data models
│       │   ├── user.go
│       │   ├── post.go
│       │   ├── group.go
│       │   ├── follower.go
│       │   ├── message.go
│       │   └── notification.go
│       └── websocket/
│           └── hub.go             # WebSocket hub (broadcast, presence)
├── frontend/
│   ├── Dockerfile
│   ├── next.config.js
│   ├── package.json
│   └── src/
│       ├── app/                   # Next.js App Router pages
│       │   ├── page.tsx           # Root / redirect
│       │   ├── login/
│       │   ├── register/
│       │   ├── feed/
│       │   ├── profile/
│       │   ├── people/
│       │   ├── groups/
│       │   ├── chat/
│       │   └── notifications/
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── Sidebar.tsx
│       │   ├── RightPanel.tsx
│       │   └── ClientProviders.tsx
│       └── lib/
│           ├── api.ts             # Fetch helpers
│           ├── useWebSocket.ts    # WebSocket hook
│           └── WebSocketContext.tsx
└── electron-app/
    ├── main.js                    # Electron main process
    ├── preload.js
    ├── package.json
    └── renderer/
        └── index.html
```

---

## Database Schema

| Table           | Description                                        |
|-----------------|----------------------------------------------------|
| `users`         | Accounts — email, hashed password, profile info    |
| `sessions`      | Auth session tokens with expiry                    |
| `posts`         | User posts with visibility control                 |
| `comments`      | Comments on posts                                  |
| `followers`     | Follow relationships (pending / accepted)          |
| `groups`        | Group pages with creator reference                 |
| `events`        | Events inside groups with RSVP responses           |
| `notifications` | System notifications (follow, group, event, etc.)  |
| `messages`      | Direct and group chat messages                     |

Migrations are run automatically on startup from `pkg/db/migrations/sqlite/`.

---

## API Endpoints

### Public
| Method | Path                    | Description            |
|--------|-------------------------|------------------------|
| POST   | `/api/auth/register`    | Register a new user    |
| POST   | `/api/auth/login`       | Login                  |
| POST   | `/api/auth/logout`      | Logout                 |
| GET    | `/api/health`           | Health check           |

### Protected (require session cookie)
| Method | Path                         | Description                       |
|--------|------------------------------|-----------------------------------|
| GET    | `/api/me`                    | Current user info                 |
| GET    | `/api/users`                 | List all users                    |
| GET    | `/api/profile`               | Get user profile                  |
| PUT    | `/api/profile/privacy`       | Toggle public/private             |
| GET/POST/DELETE | `/api/follow`       | List / follow / unfollow          |
| POST   | `/api/follow/respond`        | Respond to follow request         |
| GET    | `/api/follow/following`      | List who you follow                |
| GET/POST | `/api/posts`              | List / create posts               |
| GET/POST | `/api/posts/comment`      | List / create comments            |
| GET/POST | `/api/groups`             | List / create groups              |
| GET    | `/api/groups/detail`         | Get group details                 |
| GET    | `/api/groups/members`        | List group members                |
| POST   | `/api/groups/invite`         | Invite user to group              |
| POST   | `/api/groups/join`           | Request to join group             |
| POST   | `/api/groups/respond`        | Accept/decline membership         |
| GET/POST | `/api/groups/events`      | List / create events              |
| POST   | `/api/groups/events/respond` | RSVP to event                     |
| GET/PUT | `/api/notifications`        | List / mark as read               |
| GET/POST | `/api/messages`           | Get / send direct messages        |
| GET/POST | `/api/messages/group`     | Get / send group messages         |
| GET    | `/api/online-users`          | List online users                 |
| POST   | `/api/upload`                | Upload an image                   |
| GET    | `/api/ws`                    | WebSocket connection              |

---

## Getting Started

### Using Docker (recommended)

**Requirements:** Docker, Docker Compose

```bash
git clone https://github.com/aaleksa/My-Social-Messenger.git
cd My-Social-Messenger/social-network

docker compose up --build
```

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:3000      |
| Backend  | http://localhost:8081      |

---

### Running Locally

#### Backend

**Requirements:** Go 1.21+, GCC (for `go-sqlite3`)

```bash
cd social-network/backend
go mod download
go run server.go
# Backend starts on :8080
```

#### Frontend

**Requirements:** Node.js 18+

```bash
cd social-network/frontend
npm install
npm run dev
# Frontend starts on http://localhost:3000
```

---

## Electron Desktop App

**Requirements:** Node.js 18+

```bash
cd social-network/electron-app
npm install

# Run in development
npm start

# Build installers
npm run build:mac    # macOS .dmg
npm run build:win    # Windows .exe (NSIS)
npm run build:linux  # Linux .AppImage
```

The desktop app points to the backend running at the URL configured in `main.js`.

---

## Environment Variables

### Backend

| Variable          | Default                          | Description              |
|-------------------|----------------------------------|--------------------------|
| `PORT`            | `:8080`                          | Server listen address    |
| `DB_PATH`         | `./social_network.db`            | SQLite database file     |
| `MIGRATIONS_PATH` | `pkg/db/migrations/sqlite`       | Path to migration files  |

### Frontend

| Variable       | Default                   | Description             |
|----------------|---------------------------|-------------------------|
| `BACKEND_URL`  | `http://localhost:8080`   | Backend base URL        |

---

## License

MIT
