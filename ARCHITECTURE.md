# Baby Shower Trivia Webapp: Architecture Overview

## Overview
This web application is a real-time trivia and opinion game platform designed for events (e.g., baby showers). It supports both participant and admin roles, live question answering, real-time voting, and dynamic results. The architecture leverages modern serverless and cloud-native technologies for scalability and ease of deployment.

---

## High-Level Architecture Diagram

```
+-------------------+      +---------------------+      +-------------------+
|                   |      |                     |      |                   |
|   Participant UI  | <--> |   Next.js Server    | <--> |  Supabase (DB &   |
|  (React/Next.js)  |      | (API Routes, SSR)   |      |  Auth, Storage)   |
|                   |      |                     |      |                   |
+-------------------+      +---------------------+      +-------------------+
        ^   ^                      ^      ^                       ^
        |   |                      |      |                       |
        |   |                      |      +-----------------------+
        |   |                      |              |
        |   |                      v              v
        |   |             +-----------------+   +-------------------+
        |   +-----------> |  Pusher Server  |   |   Admin Dashboard |
        |                 | (Real-time      |   |   (React/Next.js) |
        +---------------- |  Events)        |   +-------------------+
                          +-----------------+
```

---

## Main Components

### 1. **Frontend (Next.js, React, TypeScript)**
- **Participant UI**: Allows users to join games, answer trivia/opinion questions, and view results.
- **Admin Dashboard**: Enables admins to manage questions, reset votes/players/games, show results, and monitor game state in real time.
- **UI Libraries**: Uses custom components and utility libraries for a polished, interactive experience.

### 2. **Backend (Next.js API Routes)**
- **API Endpoints**: Handle authentication, question/answer CRUD, game state management, and results calculation.
- **Server Actions**: Used for admin-triggered mutations (e.g., reset, show results, next/previous question).
- **Real-Time Events**: Integrates with Pusher for broadcasting updates (e.g., new question, vote updates, results) to all clients.

### 3. **Database (Supabase/Postgres)**
- **Tables**: `games`, `questions`, `answers`, `participants`, `answer_options`
- **Auth**: Managed via Supabase for both participant and admin sessions.
- **Storage**: Used for image assets (e.g., question images).

### 4. **Real-Time Messaging (Pusher)**
- **Game Events**: Notifies clients of state changes (e.g., question change, vote reset, results shown) for immediate UI updates.

---

## Information Flow

### 1. **Game Join & Participation**
- User joins via `/join` (participant) or `/admin` (admin).
- On join, a participant record is created in Supabase and a session cookie is set.

### 2. **Question Lifecycle**
- Admin advances the game (next/previous question) via dashboard.
- Server updates the game state in Supabase and triggers a Pusher event.
- All clients receive the new question in real time and update their UI.

### 3. **Answer Submission & Voting**
- Participants submit answers via the UI.
- Answers are stored in Supabase and optionally broadcast via Pusher for live vote counts.

### 4. **Results Calculation & Display**
- When the admin shows results, the server calculates scores and correctness.
- Results are fetched by clients and displayed, with opinion questions handled specially (no correct answer shown).

### 5. **Reset Actions (Votes, Players, Game)**
- Admin can reset votes, players, or the entire game.
- Each reset action updates/deletes records in Supabase, triggers a Pusher event, and forces a UI refresh for consistency.

---

## Security & Authentication
- **Participant Auth**: Cookie-based, lightweight for quick join and play.
- **Admin Auth**: Password-protected, with session tokens stored in cookies.
- **API Protection**: All sensitive API routes check for proper authentication.

---

## Deployment & Scalability
- **Serverless**: Runs on Vercel/Netlify or similar platforms for zero-maintenance scaling.
- **Supabase**: Managed Postgres with real-time and auth support.
- **Pusher**: Cloud real-time event delivery for low-latency updates.

---

## Extensibility
- Easily add new question types, game modes, or analytics.
- Modular code structure for both frontend and backend.

---

## Summary Table

| Layer         | Tech Stack         | Key Responsibilities                                 |
|-------------- |-------------------|------------------------------------------------------|
| Frontend      | Next.js, React    | UI, Routing, SSR/CSR, Real-time updates              |
| Backend/API   | Next.js API       | Business logic, Data access, Auth, Real-time triggers|
| Database      | Supabase/Postgres | Persistent storage, Auth, File storage               |
| Real-time     | Pusher            | Live updates to all clients                          |

---

## See Also
- [README.md](./README.md) for setup and deployment instructions
- [types/game.ts](./types/game.ts) for key data structures
- [app/admin/dashboard/page.tsx](./app/admin/dashboard/page.tsx) for admin logic
- [app/results/page.tsx](./app/results/page.tsx) for results rendering
