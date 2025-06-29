// server.js (Revised)
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require('bcrypt'); // New dependency for password hashing
const path = require("path");

const app = express();

// --- Middleware ---
app.use(express.json()); // To parse JSON bodies (e.g., for API requests)
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies (e.g., form submissions)

// Session Setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'a_strong_default_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    secure: process.env.NODE_ENV === 'production' // Use secure cookies in production (HTTPS)
  }
}));

// --- Mock Database (Replace with a real database integration) ---
// In a real application, you'd use a database like PostgreSQL, MongoDB, etc.
const users = []; // Stores { id, username, email, hashedPassword }

// --- Authentication API Routes ---

// Signup Route
app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  // Check if user already exists (mock)
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: "User with this email already exists." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10); // Hash password with salt rounds = 10
    const newUser = { id: Date.now().toString(), email, hashedPassword };
    users.push(newUser); // Save to mock DB

    console.log(`New user signed up: ${email}`);
    res.status(201).json({ message: "Account created successfully!" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Server error during signup." });
  }
});

// Login Route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  // Find user (mock)
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or access code." });
  }

  try {
    const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

    if (passwordMatch) {
      req.session.userId = user.id; // Establish session
      console.log(`User logged in: ${user.email}`);
      res.status(200).json({ message: "Login successful!", user: { id: user.id, email: user.email } });
    } else {
      res.status(401).json({ error: "Invalid email or access code." });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login." });
  }
});

// --- API Routes (protected example) ---

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) { // Check for your custom session variable
    // In a real app, you'd fetch user details from DB here if needed
    next();
  } else {
    res.status(401).json({ error: "Unauthorized: Please log in." });
  }
};

// Get current logged-in user information
app.get("/api/user", isAuthenticated, (req, res) => {
  // In a real app, you'd fetch user from DB using req.session.userId
  const user = users.find(u => u.id === req.session.userId);
  if (user) {
      res.json({ id: user.id, email: user.email });
  } else {
      res.status(404).json({ error: "User not found." });
  }
});

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => { // Destroy the session
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Error logging out.");
    }
    console.log("User logged out successfully.");
    res.redirect("/auth.html?mode=login"); // Redirect to the auth page
  });
});

// --- Static File Serving ---
app.use(express.static(path.join(__dirname, "public")));

// Catch-all route, redirects to index.html (or auth.html if not logged in)
app.get('*', (req, res) => {
  // This logic can be more sophisticated based on whether a user is logged in
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html')); // Example: redirect to dashboard if logged in
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); // Default landing page
  }
});


// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started at http://localhost:${PORT}`);
  console.log(`Open your browser to http://localhost:${PORT}`); // Start from index.html
});
