// server.js
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require('bcryptjs');
const path = require("path");
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs');

//connect-pg-simple
const pgSession = require('connect-pg-simple')(session); // <--- ADD THIS LINE

const app = express();

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- PostgreSQL Database Connection Pool ---
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('FATAL ERROR: DATABASE_URL environment variable is not set. Please set it in your .env file or Render settings.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test database connection on startup
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client from pool', err.stack);
    }
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            return console.error('Error executing test query', err.stack);
        }
        console.log('✅ Database connected successfully! Current DB time:', result.rows[0].now);
    });
});

// --- Session setup for managing user sessions ---
// Now using PostgreSQL for session storage
app.use(session({
  store: new pgSession({ // <--- MODIFIED HERE: Use pgSession for storage
    pool: pool,          // Connection pool
    tableName: 'session' // Table name for session data (you'll need to create this table)
  }),
  secret: process.env.SESSION_SECRET || 'your_very_strong_and_long_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // Session lasts for 1 day
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'Lax'
  }
}));


// --- Database Table Initialization (Optional, for quick local setup) ---
// You might also need a 'session' table for connect-pg-simple.
// connect-pg-simple can create it automatically, or you can add it here.
async function initDbTables() {
    try {
        const client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT UNIQUE
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                academic_year TEXT NOT NULL,
                semester TEXT NOT NULL,
                subject_code TEXT NOT NULL,
                notes_type TEXT NOT NULL,
                description TEXT,
                file_path TEXT NOT NULL UNIQUE,
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        // <--- OPTIONAL: Create session table if connect-pg-simple doesn't auto-create or you want explicit control
        await client.query(`
            CREATE TABLE IF NOT EXISTS "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
            ) WITH (OIDS=FALSE);
            ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
            CREATE INDEX "IDX_session_expire" ON "session" ("expire");
        `);
        // ---> END OPTIONAL session table creation
        console.log('✅ Database tables (users, notes, session) checked/created.');
        client.release();
    } catch (err) {
        console.error('Error initializing database tables:', err.stack);
    }
}
initDbTables();

// --- Authentication API Routes ---
// ... (rest of your routes, unchanged) ...

/**
 * @route POST /api/signup
 * @description Handles user registration.
 * @access Public
 */
app.post("/api/signup", async (req, res) => {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
        return res.status(400).json({ error: "Email, username, and password are required." });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            "INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email",
            [username, hashedPassword, email]
        );
        console.log(`[SIGNUP] New user created: ${email}`);
        res.status(201).json({ message: "Account created successfully! You can now log in.", user: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: "User with this username or email already exists." });
        }
        console.error("[SIGNUP ERROR]", error);
        res.status(500).json({ error: "Server error during signup. Please try again later." });
    }
});

/**
 * @route POST /api/login
 * @description Handles user login and session creation.
 * @access Public
 */
app.post("/api/login", async (req, res) => {
    const { email, password, username } = req.body;

    if ((!email && !username) || !password) {
        return res.status(400).json({ error: "Email/Username and password are required." });
    }

    try {
        let user;
        if (email) {
            const result = await pool.query("SELECT id, username, email, password_hash FROM users WHERE email = $1", [email]);
            user = result.rows[0];
        } else if (username) {
            const result = await pool.query("SELECT id, username, email, password_hash FROM users WHERE username = $1", [username]);
            user = result.rows[0];
        } else {
            return res.status(400).json({ error: "Email or username is required for login." });
        }

        if (!user) {
            return res.status(401).json({ error: "Invalid email/username or access code." });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (passwordMatch) {
            req.session.userId = user.id;
            req.session.userEmail = user.email;
            req.session.username = user.username;

            console.log(`[LOGIN] User successfully logged in: ${user.email}`);
            res.status(200).json({ message: "Login successful!", redirect: "/home.html" });
        } else {
            res.status(401).json({ error: "Invalid email/username or access code." });
        }
    } catch (error) {
        console.error("[LOGIN ERROR]", error);
        res.status(500).json({ error: "Server error during login. Please try again later." });
    }
});

// --- Protected API Routes Middleware ---
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        if (req.accepts('html')) {
            res.redirect('/auth.html?mode=login');
        } else {
            res.status(401).json({ error: "Unauthorized: Please log in." });
        }
    }
};

/**
 * @route GET /api/user
 * @description Returns current logged-in user information. Protected route.
 * @access Private (requires authentication)
 */
app.get("/api/user", isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, username, email FROM users WHERE id = $1", [req.session.userId]);
        const user = result.rows[0];

        if (user) {
            res.json({ id: user.id, username: user.username, email: user.email });
        } else {
            res.status(404).json({ error: "User data not found." });
        }
    } catch (error) {
        console.error("[GET USER ERROR]", error);
        res.status(500).json({ error: "Server error fetching user data." });
    }
});

/**
 * @route GET /api/logout
 * @description Destroys user session and logs them out.
 * @access Public
 */
app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("[LOGOUT ERROR]", err);
            return res.status(500).send("Error logging out.");
        }
        console.log("[LOGOUT] User session destroyed.");
        res.redirect("/auth.html?mode=login");
    });
});

// --- File Upload Configuration ---
const UPLOAD_FOLDER = 'uploads';
if (!fs.existsSync(UPLOAD_FOLDER)) {
    fs.mkdirSync(UPLOAD_FOLDER);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_FOLDER);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'];

function allowedFile(filename) {
    return ALLOWED_EXTENSIONS.includes(path.extname(filename).toLowerCase().substring(1));
}

// --- Notes API Routes ---

/**
 * @route POST /api/upload_note
 * @description Handles note file uploads and saves metadata to the database.
 * @access Private (requires authentication)
 */
app.post('/api/upload_note', isAuthenticated, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    if (!allowedFile(req.file.originalname)) {
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting disallowed file:", err);
        });
        return res.status(400).json({ success: false, message: 'Invalid file type. Allowed: PDF, DOC, DOCX, TXT, PPT, PPTX, ODT, ODS, ODP, RTF.' });
    }

    const { academicYear, semester, subject, notesType, description, title } = req.body;

    if (!academicYear || !semester || !subject || !notesType || !title) {
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting file due to missing metadata:", err);
        });
        return res.status(400).json({ success: false, message: 'Missing required note metadata.' });
    }

    try {
        const filePath = req.file.path;
        const userId = req.session.userId;

        const result = await pool.query(
            `INSERT INTO notes (user_id, title, academic_year, semester, subject_code, notes_type, description, file_path)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [userId, title, academicYear, semester, subject, notesType, description, filePath]
        );

        res.status(201).json({ success: true, message: 'File uploaded and note saved successfully!', noteId: result.rows[0].id });
    } catch (error) {
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting file after DB error:", err);
            });
        }
        console.error("Error during file upload and note saving:", error);
        res.status(500).json({ success: false, message: `Failed to upload note: ${error.message}` });
    }
});

/**
 * @route GET /api/notes
 * @description Retrieves notes uploaded by the authenticated user.
 * @access Private (requires authentication)
 */
app.get('/api/notes', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const result = await pool.query(
            "SELECT id, title, academic_year, semester, subject_code, notes_type, description, file_path, uploaded_at FROM notes WHERE user_id = $1 ORDER BY uploaded_at DESC",
            [userId]
        );

        const notesList = result.rows.map(note => ({
            id: note.id,
            title: note.title,
            academic_year: note.academic_year,
            semester: note.semester,
            subject_code: note.subject_code,
            notes_type: note.notes_type,
            description: note.description,
            file_url: `/uploads/${path.basename(note.file_path)}`,
            uploaded_at: note.uploaded_at.toISOString()
        }));
        res.json(notesList);
    } catch (error) {
        console.error("Error fetching notes:", error);
        res.status(500).json({ message: 'Failed to fetch notes.' });
    }
});

/**
 * @route GET /uploads/:filename
 * @description Serves uploaded files (ephemeral storage warning applies).
 * @access Private (requires authentication)
 */
app.get('/uploads/:filename', isAuthenticated, async (req, res) => {
    const filename = req.params.filename;
    const userId = req.session.userId;
    const filePath = path.join(UPLOAD_FOLDER, filename);

    try {
        const result = await pool.query(
            "SELECT user_id FROM notes WHERE file_path = $1 AND user_id = $2",
            [filePath, userId]
        );
        const note = result.rows[0];

        if (note) {
            if (fs.existsSync(filePath)) {
                res.sendFile(filePath);
            } else {
                console.warn(`File not found on disk: ${filePath}`);
                res.status(404).json({ message: 'File not found on server.' });
            }
        } else {
            res.status(404).json({ message: 'File not found or access denied.' });
        }
    } catch (error) {
        console.error("Error serving file:", error);
        res.status(500).json({ message: 'Failed to retrieve file.' });
    }
});


// --- Static File Serving ---
app.use(express.static(path.join(__dirname, "public")));

// --- Universal Route Handling (Catch-all for SPA-like routing) ---
app.get('*', (req, res) => {
  if (req.session && req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'auth.html'));
  }
});


// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started at http://localhost:${PORT}`);
  console.log(`Open your browser to http://localhost:${PORT} to begin.`);
});
