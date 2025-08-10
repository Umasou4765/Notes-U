# Notes-U

A modular, secure, student-focused note sharing platform.

## Features
- Session-based authentication (Express + PostgreSQL)
- File uploads with whitelist and size limits
- Theming (light/dark) with shared JS module
- Modular routes/services
- Toast notifications and safe DOM rendering
- Subjects list loaded from JSON (DRY across pages)
- Consistent JSON responses `{ success, message, data | error }`
- Security: helmet, rate limiting, sanitized filenames

## Stack
- Node.js / Express
- PostgreSQL
- connect-pg-simple (session store)
- Multer (file uploads)

## Setup

```bash
cp .env.example .env
# Edit .env with DATABASE_URL & SESSION_SECRET
npm install
npm run migrate  # apply schema
npm run dev      # start with nodemon
```

Visit: http://localhost:3000

## Environment Variables
| Variable | Description |
|----------|-------------|
| DATABASE_URL | Postgres connection string |
| SESSION_SECRET | Long random string |
| PORT | (optional) server port |

## Folder Structure
See root of repository (server/, public/, migrations/).

## API Overview
| Method | Path              | Auth | Description |
|--------|-------------------|------|-------------|
| POST   | /api/signup       | No   | Create account |
| POST   | /api/login        | No   | Log in |
| GET    | /api/logout       | Yes  | Log out |
| GET    | /api/user         | Yes  | Current user |
| GET    | /api/notes        | Yes  | List notes |
| POST   | /api/notes/upload | Yes  | Upload note (multipart) |
| GET    | /uploads/:file    | Yes  | Download owned file |

## Future Improvements
- Replace sessions with JWT for multi-client ecosystem
- Add password reset
- Add collaborative sharing or tagging
- Full-text search (Postgres tsvector)
- Move file storage to S3
- Introduce tests (Jest + Supertest)
