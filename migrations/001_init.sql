CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  notes_type TEXT NOT NULL,
  description TEXT,
  file_path TEXT UNIQUE NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  sid varchar NOT NULL COLLATE "default",
  sess json NOT NULL,
  expire timestamp(6) NOT NULL,
  PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

CREATE INDEX IF NOT EXISTS idx_notes_user_uploaded_at ON notes(user_id, uploaded_at DESC);