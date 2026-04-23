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
┌──────────────────────┐     HTTP / WebSocket       ┌──────────▼──────────┐
│  Electron Desktop    │ ◄──────────────────────────│   SQLite Database   │
│  (React+Vite SPA)    │         REST API           │   + Migrations      │
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
| Frontend     | Next.js 15, React 18, TypeScript    |
| Desktop      | Electron 29, Vite 6, React 18, Zustand, electron-builder |
| Container    | Docker, Docker Compose              |

---

## Features

- **Authentication** — register, login, logout with session cookies
- **User Profiles** — public / private profiles, avatars, about me, date of birth; update profile info
- **Follow System** — follow / unfollow users; private profiles require approval; view pending requests
- **Posts & Comments** — create / delete posts (with image upload), like / unlike posts, add comments, control visibility (public / followers / selected users)
- **Groups** — create groups, invite members, request to join, manage membership
- **Events** — create events inside groups, RSVP (going / not going)
- **Real-time Chat** — private direct messages and group chat via WebSocket; supports image attachments
- **Notifications** — follow requests, group invitations, event updates — all delivered in real time
- **Online Presence** — see which users are currently online (with client type: web / desktop)
- **Image Uploads** — upload and serve profile avatars, post images, and chat images
- **Desktop App** — Electron wrapper (React + Vite renderer) for macOS, Windows, and Linux

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
│   ├── next-env.d.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── app/                   # Next.js App Router pages
│       │   ├── page.tsx           # Root / redirect
│       │   ├── login/
│       │   ├── register/
│       │   ├── feed/
│       │   ├── profile/
│       │   │   └── [id]/          # Dynamic user profile page
│       │   ├── people/
│       │   ├── groups/
│       │   │   └── [id]/          # Dynamic group detail page
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
    ├── main.js                    # Electron main process (session, IPC, notifications)
    ├── preload.js                 # Context bridge (IPC API exposed to renderer)
    ├── package.json
    └── renderer/                  # React + Vite SPA (served in Electron window)
        ├── vite.config.js
        ├── package.json           # React 18, Zustand, Vite 6
        ├── index.html
        └── src/
            ├── App.jsx
            ├── main.jsx
            ├── store/             # Zustand global state
            ├── lib/               # api.js, ws.js
            ├── hooks/             # useOnline.js
            ├── styles/
            └── components/
                ├── auth/          # Login
                ├── chat/          # Chat, ChatSidebar, ChatWindow
                ├── feed/          # Feed, PostCard, PostCreate
                ├── groups/        # Groups, GroupDetail
                ├── layout/        # Layout, Sidebar, Topbar
                ├── notifications/ # Notifications
                ├── people/        # People
                ├── profile/       # Profile, UserProfile
                └── ui/            # Avatar, Modal, Toast
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
| `messages`      | Direct and group chat messages (supports image attachments) |

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
| GET    | `/api/auth/ws-token`         | Get session token for WebSocket   |
| GET    | `/api/me`                    | Current user info                 |
| GET    | `/api/users`                 | List all users                    |
| GET    | `/api/profile`               | Get user profile (by `?id=`)      |
| PUT/POST | `/api/profile`             | Update own profile                |
| PUT    | `/api/profile/privacy`       | Toggle public/private             |
| GET    | `/api/follow`                | List followers                    |
| POST   | `/api/follow`                | Follow a user                     |
| DELETE | `/api/follow`                | Unfollow a user                   |
| POST   | `/api/follow/respond`        | Respond to follow request         |
| GET    | `/api/follow/following`      | List who you follow               |
| GET    | `/api/follow/requests`       | List pending follow requests      |
| GET    | `/api/posts`                 | List posts                        |
| POST   | `/api/posts`                 | Create a post                     |
| DELETE | `/api/posts`                 | Delete a post                     |
| POST   | `/api/posts/like`            | Toggle like on a post             |
| GET    | `/api/posts/comment`         | List comments on a post           |
| POST   | `/api/posts/comment`         | Add a comment                     |
| GET/POST | `/api/groups`             | List / create groups              |
| GET    | `/api/groups/detail`         | Get group details                 |
| GET    | `/api/groups/members`        | List group members                |
| POST   | `/api/groups/invite`         | Invite user to group              |
| POST   | `/api/groups/join`           | Request to join group             |
| POST   | `/api/groups/respond`        | Accept/decline membership         |
| GET    | `/api/groups/events`         | List events for a group           |
| POST   | `/api/groups/events`         | Create event (group creator only) |
| PUT    | `/api/groups/events`         | Update event (creator/owner)      |
| DELETE | `/api/groups/events`         | Delete event (creator/owner)      |
| POST   | `/api/groups/events/respond` | RSVP to event                     |
| GET    | `/api/notifications`         | List notifications                |
| PUT    | `/api/notifications`         | Mark notifications as read        |
| GET    | `/api/messages`              | Get direct messages               |
| POST   | `/api/messages`              | Send a direct message             |
| GET    | `/api/messages/group`        | Get group messages                |
| POST   | `/api/messages/group`        | Send a group message              |
| GET    | `/api/online-users`          | List online users (with type)     |
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

The Electron app embeds a full **React + Vite** SPA (located in `renderer/`) and communicates with the Go backend via REST and WebSocket. Session data is persisted locally in the user data directory.

```bash
cd social-network/electron-app

# Install host (Electron) dependencies
npm install

# Install renderer (React/Vite) dependencies
cd renderer && npm install && cd ..

# Run in development (starts Vite dev server + Electron together)
npm run dev

# Or start Electron only (loads pre-built renderer/dist)
npm start

# Build installers
npm run build:mac    # macOS .dmg
npm run build:win    # Windows .exe (NSIS)
npm run build:linux  # Linux .AppImage
```

The `npm run dev` command uses `concurrently` to launch the Vite dev server on port **5173** and Electron simultaneously, with `wait-on` ensuring Electron loads only after the dev server is ready.

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

### Electron Desktop App

| Variable        | Default | Description                                      |
|-----------------|---------|--------------------------------------------------|
| `ELECTRON_DEV`  | `false` | Set to `true` to load from Vite dev server (port 5173) and open DevTools |

---

## License

MIT
