// server.js
require("dotenv").config(); // Loads environment variables from a .env file

const express = require("express");
const session = require("express-session");
const bcrypt = require('bcrypt'); // For password hashing
const path = require("path"); // For working with file paths

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

// --- Mock Database (!!! REPLACE WITH A REAL DATABASE IN PRODUCTION !!!) ---
// This array will store user objects in memory and will be reset when the server restarts.
const users = []; // Format: { id, email, hashedPassword }

// --- Authentication API Routes ---

/**
 * @route POST /api/signup
 * @description Handles user registration.
 * @access Public
 */
app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  // Basic email format validation (more robust validation should be added)
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  // Password strength check (example - enhance as needed)
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }

  // Check if user already exists (mock DB lookup)
  if (users.some(u => u.email === email)) { // Using .some() for better readability
    return res.status(409).json({ error: "User with this email already exists." });
  }

  try {
    // Hash the password with a salt (cost factor of 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user object
    const newUser = { id: Date.now().toString(), email, hashedPassword };
    users.push(newUser); // Add to mock database

    console.log(`[SIGNUP] New user created: ${email}`);
    // Respond with success message. Do NOT send hashedPassword back.
    res.status(201).json({ message: "Account created successfully! You can now log in." });
  } catch (error) {
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
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  // Find user by email in the mock database
  const user = users.find(u => u.email === email);

  // If user not found, or password doesn't match, return generic error for security
  if (!user) {
    return res.status(401).json({ error: "Invalid email or access code." });
  }

  try {
    // Compare the provided password with the stored hashed password
    const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

    if (passwordMatch) {
      req.session.userId = user.id; // Store user ID in session
      req.session.userEmail = user.email; // Store user email in session (optional, for convenience)

      console.log(`[LOGIN] User successfully logged in: ${user.email}`);
      // Send a success response. Client-side JS will handle redirection.
      res.status(200).json({ message: "Login successful!", redirect: "/home.html" });
    } else {
      res.status(401).json({ error: "Invalid email or access code." });
    }
  } catch (error) {
    console.error("[LOGIN ERROR]", error);
    res.status(500).json({ error: "Server error during login. Please try again later." });
  }
});

// --- Protected API Routes ---

/**
 * @description Middleware to protect routes, ensuring only authenticated users can access them.
 */
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    // User is authenticated, proceed to the next middleware/route handler
    next();
  } else {
    // User is not authenticated, send an unauthorized response
    // Optionally, redirect to login page for browser requests
    if (req.accepts('html')) { // If the client expects HTML
      res.redirect('/auth.html?mode=login');
    } else { // If it's an API request (e.g., from fetch)
      res.status(401).json({ error: "Unauthorized: Please log in." });
    }
  }
};

/**
 * @route GET /api/user
 * @description Returns current logged-in user information. Protected route.
 * @access Private (requires authentication)
 */
app.get("/api/user", isAuthenticated, (req, res) => {
  // In a real application, you might fetch fresh user data from the database
  // using req.session.userId to ensure it's up-to-date.
  const user = users.find(u => u.id === req.session.userId);
  if (user) {
      res.json({ id: user.id, email: user.email });
  } else {
      // This case should ideally not happen if isAuthenticated passed,
      // but it's good for robustness, e.g., if mock 'users' array resets.
      res.status(404).json({ error: "User data not found in session or mock DB." });
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

// --- Static File Serving ---

// Serve static files (HTML, CSS, JS, images) from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// --- Universal Route Handling (Catch-all) ---

/**
 * @route GET *
 * @description A catch-all route to handle all other GET requests.
 * Redirects based on authentication status.
 * @access Public/Private (depending on state)
 */
app.get('*', (req, res) => {
  // If the user is logged in (session exists), send them to home.html
  if (req.session && req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
  } else {
    // If not logged in, send them to the main landing page (index.html)
    // or you could send them directly to auth.html if all pages require login
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});


// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started at http://localhost:${PORT}`);
  console.log(`Open your browser to http://localhost:${PORT} to begin.`);
});
