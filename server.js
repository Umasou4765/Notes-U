// server.js
require("dotenv").config(); // Loads environment variables from a .env file

const express = require("express");
const session = require("express-session");
const bcrypt = require('bcryptjs'); // For password hashing (using bcryptjs for Node.js compatibility)
const path = require("path"); // For working with file paths
const { Pool } = require('pg'); // PostgreSQL client
const multer = require('multer'); // For handling file uploads
const fs = require('fs'); // Import the file system module

// connect-pg-simple
const pgSession = require('connect-pg-simple')(session);

const app = express();

// --- Middleware ---

// Parse JSON bodies for API requests
app.use(express.json());

// Parse URL-encoded bodies, typically for form submissions
app.use(express.urlencoded({ extended: true }));

// --- PostgreSQL Database Connection Pool ---
// Moved pool initialization BEFORE session setup
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('FATAL ERROR: DATABASE_URL environment variable is not set. Please set it in your .env file or Render settings.');
    process.exit(1); // Exit if no database connection string
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
        rejectUnauthorized: false // Required for Supabase connections from Render
    }
});

// Test database connection on startup
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client from pool', err.stack);
    }
    client.query('SELECT NOW()', (err, result) => {
        release(); // Release the client back to the pool
        if (err) {
            return console.error('Error executing test query', err.stack);
        }
        console.log('✅ Database connected successfully! Current DB time:', result.rows[0].now);
    });
});


// Session setup for managing user sessions
app.use(session({
  store: new pgSession({ // Using pgSession for storage
    pool: pool,          // Connection pool (now 'pool' is defined!)
    tableName: 'session' // Table name for session data (you'll need to create this table)
  }),
  secret: process.env.SESSION_SECRET || 'your_very_strong_and_long_secret_key', // **IMPORTANT: Change this to a truly random, long string**
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something is stored
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // Session lasts for 1 day
    secure: process.env.NODE_ENV === 'production', // Use secure cookies (HTTPS) in production
    httpOnly: true, // Prevents client-side JavaScript from accessing cookies
    sameSite: 'Lax' // Protection against CSRF attacks
  }
}));

// --- Database Table Initialization (Optional, for quick local setup) ---
// In production, you typically run these SQL commands directly in your Supabase SQL Editor.
async function initDbTables() {
    try {
        const client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT UNIQUE -- Email is UNIQUE, but can be NULL if not provided
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
        // Create session table for connect-pg-simple
        await client.query(`
            CREATE TABLE IF NOT EXISTS "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
            ) WITH (OIDS=FALSE);
            ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
            CREATE INDEX "IDX_session_expire" ON "session" ("expire");
        `);
        console.log('✅ Database tables (users, notes, session) checked/created.');
        client.release();
    } catch (err) {
        console.error('Error initializing database tables:', err.stack);
    }
}
// Call table initialization on app startup
initDbTables();

// --- Authentication API Routes ---

/**
 * @route POST /api/signup
 * @description Handles user registration.
 * @access Public
 */
app.post("/api/signup", async (req, res) => {
  console.log('[SIGNUP] Received signup request. Body:', req.body); // Added log

  const { email, password, username } = req.body;

  if (!username || !password) {
    console.warn('[SIGNUP] Missing username or password.'); // Added log
    return res.status(400).json({ error: "Username and password are required for signup." });
  }

  if (email && !/\S+@\S+\.\S+/.test(email)) {
    console.warn('[SIGNUP] Invalid email format:', email); // Added log
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  if (password.length < 8) {
    console.warn('[SIGNUP] Password too short.'); // Added log
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }

  try {
    console.log('[SIGNUP] Hashing password for username:', username); // Added log
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('[SIGNUP] Attempting to insert new user:', username); // Added log
    const result = await pool.query(
      "INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, hashedPassword, email || null]
    );

    console.log(`[SIGNUP] New user created successfully: ${username} (ID: ${result.rows[0].id})`); // Added log
    res.status(201).json({ message: "Account created successfully! You can now log in.", user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      let errorMessage = "User with this username or email already exists.";
      if (error.detail && error.detail.includes('Key (username)')) {
          errorMessage = "This username is already taken.";
      } else if (error.detail && error.detail.includes('Key (email)')) {
          errorMessage = "This email is already registered.";
      }
      console.warn(`[SIGNUP] Conflict: ${errorMessage} (Error code: ${error.code})`); // Added log
      return res.status(409).json({ error: errorMessage });
    }
    console.error("[SIGNUP ERROR] Server error:", error); // Detailed error log
    res.status(500).json({ error: "Server error during signup. Please try again later." });
  }
});

/**
 * @route POST /api/login
 * @description Handles user login and session creation.
 * @access Public
 */
app.post("/api/login", async (req, res) => {
  console.log('[LOGIN] Received login request. Body:', req.body); // Added log

  // --- MODIFIED: Login now only accepts username ---
  const { username, password } = req.body; // Only get username and password

  if (!username || !password) {
    console.warn('[LOGIN] Missing username or password.'); // Added log
    return res.status(400).json({ error: "Username and password are required for login." });
  }

  try {
    console.log('[LOGIN] Searching for user:', username); // Added log
    // Attempt to find user by username only
    const result = await pool.query("SELECT id, username, email, password_hash FROM users WHERE username = $1", [username]);
    const user = result.rows[0];

    if (!user) {
      console.warn(`[LOGIN] User not found for username: ${username}`); // Added log
      return res.status(401).json({ error: "Account not found." });
    }

    console.log('[LOGIN] Comparing password for user:', user.username); // Added log
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (passwordMatch) {
      req.session.userId = user.id; // Store user ID in session
      req.session.userEmail = user.email; // Store user email in session (optional)
      req.session.username = user.username; // Store username in session (optional)

      console.log(`[LOGIN] User successfully logged in: ${user.username}`); // Added log
      res.status(200).json({ message: "Login successful!", redirect: "/home.html" });
    } else {
      console.warn('[LOGIN] Incorrect password for user:', user.username); // Added log
      res.status(401).json({ error: "Incorrect password." });
    }
  } catch (error) {
    console.error("[LOGIN ERROR] Server error:", error); // Detailed error log
    res.status(500).json({ error: "Server error during login. Please try again later." });
  }
});

// --- Protected API Routes Middleware ---

/**
 * @description Middleware to protect routes, ensuring only authenticated users can access them.
 */
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    next(); // User is authenticated, proceed
  } else {
    // User is not authenticated
    if (req.accepts('html')) { // If client expects HTML (e.g., direct browser navigation)
      console.warn('[AUTH] Redirecting unauthenticated HTML request to login page.'); // Added log
      res.redirect('/auth.html?mode=login');
    } else { // If it's an API request (e.g., from fetch in frontend JS)
      console.warn('[AUTH] Responding with 401 for unauthenticated API request.'); // Added log
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
  console.log(`[GET /api/user] Fetching user info for ID: ${req.session.userId}`); // Added log
  try {
    const result = await pool.query("SELECT id, username, email FROM users WHERE id = $1", [req.session.userId]);
    const user = result.rows[0];

    if (user) {
      console.log(`[GET /api/user] User info found: ${user.username}`); // Added log
      res.json({ id: user.id, username: user.username, email: user.email });
    } else {
      console.warn(`[GET /api/user] User data not found for ID: ${req.session.userId} (after authentication).`); // Added log
      res.status(404).json({ error: "User data not found." });
    }
  } catch (error) {
    console.error("[GET USER ERROR] Server error:", error); // Detailed error log
    res.status(500).json({ error: "Server error fetching user data." });
  }
});

/**
 * @route GET /api/logout
 * @description Destroys user session and logs them out.
 * @access Public
 */
app.get("/api/logout", (req, res) => {
  console.log('[LOGOUT] Attempting to destroy session.'); // Added log
  req.session.destroy((err) => { // Destroy the session
    if (err) {
      console.error("[LOGOUT ERROR] Server error during session destroy:", err); // Detailed error log
      return res.status(500).send("Error logging out.");
    }
    console.log("[LOGOUT] User session destroyed. Redirecting to login."); // Added log
    res.redirect("/auth.html?mode=login");
  });
});

// --- File Upload Configuration ---
const UPLOAD_FOLDER = 'uploads';
if (!fs.existsSync(UPLOAD_FOLDER)) { // Ensure 'uploads' directory exists
    console.log(`[INIT] Creating upload folder: ${UPLOAD_FOLDER}`); // Added log
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
    console.log('[UPLOAD] Received file upload request. User ID:', req.session.userId); // Added log
    if (!req.file) {
        console.warn('[UPLOAD] No file uploaded.'); // Added log
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    if (!allowedFile(req.file.originalname)) {
        console.warn('[UPLOAD] Invalid file type detected:', req.file.originalname); // Added log
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("[UPLOAD ERROR] Error deleting disallowed file:", err);
        });
        return res.status(400).json({ success: false, message: 'Invalid file type. Allowed: PDF, DOC, DOCX, TXT, PPT, PPTX, ODT, ODS, ODP, RTF.' });
    }

    const { academicYear, semester, subject, notesType, description, title } = req.body;

    if (!academicYear || !semester || !subject || !notesType || !title) {
        console.warn('[UPLOAD] Missing required note metadata.'); // Added log
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("[UPLOAD ERROR] Error deleting file due to missing metadata:", err);
        });
        return res.status(400).json({ success: false, message: 'Missing required note metadata.' });
    }

    try {
        const filePath = req.file.path;
        const userId = req.session.userId;

        console.log(`[UPLOAD] Saving note metadata for user ${userId}, file: ${filePath}`); // Added log
        const result = await pool.query(
            `INSERT INTO notes (user_id, title, academic_year, semester, subject_code, notes_type, description, file_path)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [userId, title, academicYear, semester, subject, notesType, description, filePath]
        );

        console.log(`[UPLOAD] Note saved successfully with ID: ${result.rows[0].id}`); // Added log
        res.status(201).json({ success: true, message: 'File uploaded and note saved successfully!', noteId: result.rows[0].id });
    } catch (error) {
        if (req.file && req.file.path) {
            console.error("[UPLOAD ERROR] Server error during note saving, attempting to delete uploaded file.", error); // Added log
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("[UPLOAD ERROR] Error deleting file after DB error:", err);
            });
        } else {
            console.error("[UPLOAD ERROR] Server error during note saving:", error); // Added log
        }
        res.status(500).json({ success: false, message: `Failed to upload note: ${error.message}` });
    }
});

/**
 * @route GET /api/notes
 * @description Retrieves notes uploaded by the authenticated user.
 * @access Private (requires authentication)
 */
app.get('/api/notes', isAuthenticated, async (req, res) => {
    console.log('[GET /api/notes] Fetching notes for user ID:', req.session.userId); // Added log
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
        console.log(`[GET /api/notes] Found ${notesList.length} notes for user ID: ${userId}`); // Added log
        res.json(notesList);
    } catch (error) {
        console.error("[GET NOTES ERROR] Server error:", error); // Detailed error log
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

    console.log(`[GET /uploads] Attempting to serve file ${filename} for user ID: ${userId}`); // Added log
    try {
        const result = await pool.query(
            "SELECT user_id FROM notes WHERE file_path = $1 AND user_id = $2",
            [filePath, userId]
        );
        const note = result.rows[0];

        if (note) {
            if (fs.existsSync(filePath)) {
                console.log(`[GET /uploads] Serving file: ${filePath}`); // Added log
                res.sendFile(filePath);
            } else {
                console.warn(`[GET /uploads] File not found on disk: ${filePath}`); // Added log
                res.status(404).json({ message: 'File not found on server.' });
            }
        } else {
            console.warn(`[GET /uploads] File not found in DB or access denied for ${filename}, user ID: ${userId}`); // Added log
            res.status(404).json({ message: 'File not found or access denied.' });
        }
    } catch (error) {
        console.error("[GET UPLOADS ERROR] Server error:", error); // Detailed error log
        res.status(500).json({ message: 'Failed to retrieve file.' });
    }
});


// --- Static File Serving ---
app.use(express.static(path.join(__dirname, "public")));

// --- Universal Route Handling (Catch-all for SPA-like routing) ---
app.get('*', (req, res) => {
  console.log(`[CATCH-ALL] Incoming request for ${req.path}. Session userId: ${req.session.userId}`); // Added log
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
