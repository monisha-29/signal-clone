# Signal Messenger Clone

A premium, functional clone of Signal Messenger built as a Software Development Engineer (SDE) Fullstack Assignment. This application features high UI fidelity to Signal, real-time message exchange via WebSockets, and a clean SQLite schema.

---

## Tech Stack
* **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Lucide React
* **Backend**: FastAPI (Python), SQLAlchemy ORM, Pydantic v2
* **DB**: SQLite (Single-file DB `signal.db` in workspace root)
* **Real-time**: WebSockets (FastAPI native WebSocket Connection Manager)
* **Auth**: JWT session stored in HTTPOnly cookie + Mocked OTP verification

---

## Architecture Overview

```
[ Next.js Frontend ] <=== HTTP REST APIs (Auth, Conversations, History) ===> [ FastAPI Backend ]
        ||                                                                      ||
        ||                                                                      ||
[ WebSockets Client ] <=============== Bi-directional live link ================> [ WS Room Manager ]
```

* **HTTP Layer**: Next.js uses credentialed fetch requests (`credentials: 'include'`) to securely transmit the JWT session inside an `httpOnly` cookie.
* **Real-time WS Layer**: On login, a JWT `access_token` is also written to localStorage. Next.js creates a native WebSocket connection to `/api/ws?token=...`. The backend validates the token, maps the connection, and distributes events (typing status, receipts, and text messages) to online users in the corresponding rooms.

---

## Database Schema (SQLite)

* **`users`**: Represents the platform members.
  * `id` (PK, Integer)
  * `phone_or_username` (Unique, String)
  * `display_name` (String)
  * `avatar_url` (String, Nullable)
  * `status` (String - "online" / "offline")
  * `created_at` (DateTime)
* **`contacts`**: Models user-to-user friendships (the "added contacts" layout).
  * `id` (PK, Integer)
  * `owner_id` (FK `users.id`)
  * `contact_user_id` (FK `users.id`)
  * `created_at` (DateTime)
* **`conversations`**: Tracks active chat rooms.
  * `id` (PK, Integer)
  * `type` (String - "direct" or "group")
  * `name` (String, Nullable - group only)
  * `avatar_url` (String, Nullable - group only)
  * `created_at` (DateTime)
  * `last_message_at` (DateTime)
* **`conversation_members`**: Manages memberships, user roles, and unread metrics.
  * `id` (PK, Integer)
  * `conversation_id` (FK `conversations.id`)
  * `user_id` (FK `users.id`)
  * `role` (String - "admin" or "member")
  * `joined_at` (DateTime)
  * `last_read_message_id` (FK `messages.id`, Nullable)
* **`messages`**: Stores message payloads.
  * `id` (PK, Integer)
  * `conversation_id` (FK `conversations.id`)
  * `sender_id` (FK `users.id`)
  * `content` (String)
  * `created_at` (DateTime)
  * `status` (String - "sending", "sent", "delivered", "read")
  * *Index*: Composite index on `(conversation_id, created_at)` for paginating chats efficiently.
* **`message_receipts`**: Granular tracking per member for read/delivery checks (essential for group receipts).
  * `id` (PK, Integer)
  * `message_id` (FK `messages.id`)
  * `user_id` (FK `users.id`)
  * `status` (String - "delivered", "read")
  * `timestamp` (DateTime)

---

## API Overview

Interactive OpenAPI Swagger UI is available at: [http://localhost:8000/docs](http://localhost:8000/docs)

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/register` | `POST` | Registers a new user with display name and avatar seed |
| `/api/auth/login` | `POST` | Accepts user + 6-digit OTP (e.g. `123456`), sets JWT cookie |
| `/api/auth/logout` | `POST` | Clears cookie session |
| `/api/auth/me` | `GET` | Returns currently authenticated user details |
| `/api/users/search` | `GET` | Search members by username or display name |
| `/api/users/contacts` | `GET` / `POST` | Manage added contacts |
| `/api/conversations` | `GET` | Lists conversations sorted by `last_message_at` |
| `/api/conversations/direct` | `POST` | Start direct chat with another user |
| `/api/conversations/group` | `POST` | Start group chat with member list |
| `/api/messages/{id}` | `GET` | Load chat history for a conversation |
| `/api/messages/{id}/read` | `POST` | Manually mark conversation messages as read |
| `/api/ws` | `WS` | Real-time WebSocket connection route |

---

## Running Locally

### 1. Run Backend Server
From the project root:
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Unix/Mac:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*Note: The database seeds automatically on backend startup if the SQLite file is empty.*

### 2. Run Next.js Frontend
From the project root:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the client app.

---

## Assumptions Made

1. **Mocked OTP**: The registration uses any name/avatar, and the login interface verifies any 6-digit input (e.g. `123456` or custom) to mock SMS authorization.
2. **Mocked E2E Encryption**: To preserve high-fidelity UI layout, a "Secure Connection badge" is rendered, indicating E2E encryption without client-side cryptographic keys.
3. **Database Lifespan**: Database seeds automatically on initial startup. If you wish to wipe the state, simply delete `signal.db` and restart uvicorn.
