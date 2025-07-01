// server.js
require("dotenv").config(); // Loads environment variables from a .env file

const fs = require('fs');
const express = require("express");
const session = require("express-session");
const bcrypt = require('bcryptjs'); // For password hashing (using bcryptjs for Node.js compatibility)
const path = require("path"); // For working with file paths
const { Pool } = require('"pg": "7.18.2"'); // PostgreSQL client
const multer = require('multer'); // For handling file uploads

const app = express();

// --- Middleware ---

// Parse JSON bodies for API requests
app.use(express.json());

// Parse URL-encoded bodies, typically for form submissions
app.use(express.urlencoded({ extended: true }));

// Session setup for managing user sessions
app.use(session({
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
        console.log('✅ Database tables (users, notes) checked/created.');
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
  const { email, password, username } = req.body; // Added username based on your Flask schema

  if (!email || !password || !username) {
    return res.status(400).json({ error: "Email, username, and password are required." });
  }

  // Basic email format validation
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  // Password strength check
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password

    // Insert user into PostgreSQL (using $1, $2, $3 placeholders)
    const result = await pool.query(
      "INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, hashedPassword, email]
    );

    console.log(`[SIGNUP] New user created: ${email}`);
    res.status(201).json({ message: "Account created successfully! You can now log in.", user: result.rows[0] });
  } catch (error) {
    // Check for unique constraint violation (PostgreSQL error code 23505)
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
  const { email, password, username } = req.body; // Added username field, or use email as primary login ID

  if ((!email && !username) || !password) { // Allow login by email or username
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
      req.session.userId = user.id; // Store user ID in session
      req.session.userEmail = user.email; // Store user email in session (optional)
      req.session.username = user.username; // Store username in session (optional)

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
    // Redirect to the login page after successful logout
    res.redirect("/auth.html?mode=login");
  });
});

// --- File Upload Configuration ---
// Configure Multer for file storage
// IMPORTANT: Local file storage on Render is EPHEMERAL.
// Files saved here WILL BE LOST when your application restarts or redeploys.
// For persistent storage, you MUST use a cloud storage solution like:
// - Supabase Storage (highly recommended since you're using Supabase DB)
// - AWS S3, Google Cloud Storage, etc.
// The current setup is for demonstration/local development ONLY.
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
            // Generate a URL for downloading the file.
            // Using path.basename to get only the filename from the stored file_path.
            file_url: `/uploads/${path.basename(note.file_path)}`,
            uploaded_at: note.uploaded_at.toISOString() // Convert Date object to ISO string for frontend
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
        // Verify if the file exists and belongs to the current user
        const result = await pool.query(
            "SELECT user_id FROM notes WHERE file_path = $1 AND user_id = $2",
            [filePath, userId]
        );
        const note = result.rows[0];

        if (note) {
            // Check if the file actually exists on the server (important due to ephemeral storage)
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
// Serve static files (HTML, CSS, JS, images) from the 'public' directory
// Assumes home.html, auth.html, index.html are inside the 'public' folder.
app.use(express.static(path.join(__dirname, "public")));

// --- Universal Route Handling (Catch-all for SPA-like routing) ---
// This route should be LAST to ensure API routes are matched first.
app.get('*', (req, res) => {
  // If the user is logged in (session exists), send them to home.html
  if (req.session && req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
  } else {
    // If not logged in, send them to the main landing page (index.html)
    // or you could send them directly to auth.html if all pages require login
    // Depending on your auth.html and index.html setup:
    res.sendFile(path.join(__dirname, 'public', 'auth.html')); // Assuming auth.html is the primary entry for unauthenticated users
  }
});


// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started at http://localhost:${PORT}`);
  console.log(`Open your browser to http://localhost:${PORT} to begin.`);
});

