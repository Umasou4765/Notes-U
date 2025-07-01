// server.js
require("dotenv").config(); // Loads environment variables from a .env file

const express = require("express");
const session = require("express-session");
const bcrypt = require('bcryptjs'); // For password hashing (using bcryptjs for Node.js compatibility)
const path = require("path"); // For working with file paths
const { Pool } = require('pg'); // PostgreSQL client
const multer = require('multer'); // For handling file uploads
const fs = require('fs'); // <--- ADDED THIS LINE IN PREVIOUS FIX: Import the file system module

// 导入 connect-pg-simple
const pgSession = require('connect-pg-simple')(session); // <--- ADDED THIS LINE IN PREVIOUS FIX

const app = express();

// --- Middleware ---

// Parse JSON bodies for API requests
app.use(express.json());

// Parse URL-encoded bodies, typically for form submissions
app.use(express.urlencoded({ extended: true }));

// Session setup for managing user sessions
// IMPORTANT PRODUCTION WARNING: MemoryStore is NOT suitable for production.
// It will cause sessions to be lost on app restarts/redeploys and does not scale.
// Consider using a persistent session store like connect-pg-simple (for PostgreSQL), Redis, etc.
app.use(session({
  store: new pgSession({ // <--- Using pgSession for storage
    pool: pool,          // Connection pool
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

// --- PostgreSQL Database Connection Pool ---
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
  const { email, password, username } = req.body;

  // --- MODIFIED VALIDATION LOGIC HERE ---
  // Based on DB schema: username is NOT NULL, email is UNIQUE (and can be NULL)
  // So, username and password are required for signup. Email is optional.
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required for signup." });
  }

  // Basic email format validation, ONLY if email is provided
  if (email && !/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  // Password strength check
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }
  // --- END MODIFIED VALIDATION LOGIC ---

  try {
    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password

    // Insert user into PostgreSQL
    // If email is not provided, it will be inserted as NULL
    const result = await pool.query(
      "INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, hashedPassword, email || null] // Use null if email is undefined/empty string
    );

    console.log(`[SIGNUP] New user created: ${username} (Email: ${email || 'N/A'})`);
    res.status(201).json({ message: "Account created successfully! You can now log in.", user: result.rows[0] });
  } catch (error) {
    // Check for unique constraint violation (PostgreSQL error code 23505)
    if (error.code === '23505') {
      let errorMessage = "User with this username or email already exists.";
      // You can add more specific checks here if needed, e.g., error.detail
      if (error.detail && error.detail.includes('Key (username)')) {
          errorMessage = "This username is already taken.";
      } else if (error.detail && error.detail.includes('Key (email)')) {
          errorMessage = "This email is already registered.";
      }
      return res.status(409).json({ error: errorMessage });
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
  const { email, password, username } = req.body; // Login can accept either email or username

  if ((!email && !username) || !password) { // Requires either email OR username, AND password
    return res.status(400).json({ error: "Email/Username and password are required for login." });
  }

  try {
    let user;
    if (email) {
        // Attempt to find user by email
        const result = await pool.query("SELECT id, username, email, password_hash FROM users WHERE email = $1", [email]);
        user = result.rows[0];
    } else if (username) {
        // Attempt to find user by username
        const result = await pool.query("SELECT id, username, email, password_hash FROM users WHERE username = $1", [username]);
        user = result.rows[0];
    } else {
        // This case should ideally be caught by the initial !email && !username check, but for robustness
        return res.status(400).json({ error: "Email or username is required for login." });
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid username/email or password." }); // Generic message for security
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (passwordMatch) {
      req.session.userId = user.id; // Store user ID in session
      req.session.userEmail = user.email; // Store user email in session (optional)
      req.session.username = user.username; // Store username in session (optional)

      console.log(`[LOGIN] User successfully logged in: ${user.username || user.email}`);
      res.status(200).json({ message: "Login successful!", redirect: "/home.html" });
    } else {
      res.status(401).json({ error: "Invalid username/email or password." }); // Generic message for security
    }
  } catch (error) {
    console.error("[LOGIN ERROR]", error);
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
      res.redirect('/auth.html?mode=login');
    } else { // If it's an API request (e.g., from fetch in frontend JS)
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
    // Fetch fresh user data from DB to ensure it's up-to-date
    const result = await pool.query("SELECT id, username, email FROM users WHERE id = $1", [req.session.userId]);
    const user = result.rows[0];

    if (user) {
      res.json({ id: user.id, username: user.username, email: user.email });
    } else {
      // This should ideally not happen if isAuthenticated passed,
      // but handles cases where user might have been deleted from DB
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
  req.session.destroy((err) => { // Destroy the session
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
if (!fs.existsSync(UPLOAD_FOLDER)) { // Ensure 'uploads' directory exists
    fs.mkdirSync(UPLOAD_FOLDER);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_FOLDER);
    },
    filename: (req, file, cb) => {
        // Create unique filenames to prevent overwrites
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
    // Multer places uploaded file info on req.file
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    if (!allowedFile(req.file.originalname)) {
        // If file type is not allowed, delete the uploaded file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting disallowed file:", err);
        });
        return res.status(400).json({ success: false, message: 'Invalid file type. Allowed: PDF, DOC, DOCX, TXT, PPT, PPTX, ODT, ODS, ODP, RTF.' });
    }

    const { academicYear, semester, subject, notesType, description, title } = req.body; // Adjusted to match frontend form names

    if (!academicYear || !semester || !subject || !notesType || !title) {
        // If metadata is missing, delete the uploaded file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting file due to missing metadata:", err);
        });
        return res.status(400).json({ success: false, message: 'Missing required note metadata.' });
    }

    try {
        const filePath = req.file.path; // Path where multer saved the file
        const userId = req.session.userId; // Get user ID from session

        const result = await pool.query(
            `INSERT INTO notes (user_id, title, academic_year, semester, subject_code, notes_type, description, file_path)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [userId, title, academicYear, semester, subject, notesType, description, filePath]
        );

        res.status(201).json({ success: true, message: 'File uploaded and note saved successfully!', noteId: result.rows[0].id });
    } catch (error) {
        // If an error occurs after saving the file but before DB commit, delete the file
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
