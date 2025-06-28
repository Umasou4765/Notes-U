require("dotenv").config(); // Load .env file contents at the very beginning

const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const path = require("path"); // For robust static file serving

const app = express();

// --- Session Setup ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'a_strong_default_secret', // Use a more robust default or ensure .env is always set
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day in milliseconds (optional, for session longevity)
  }
}));

// Initialize Passport for authentication
app.use(passport.initialize());
app.use(passport.session());

// --- Passport User Serialization & Deserialization ---
// Determines what user data to store in the session
passport.serializeUser((user, done) => {
  // In a real app, you'd typically serialize a user ID from your database
  // e.g., done(null, user.id);
  done(null, user); // For now, storing the whole GitHub profile
});

// Retrieves user data from the session
passport.deserializeUser((obj, done) => {
  // In a real app, you'd fetch the user from your database using the ID
  // e.g., User.findById(id, (err, user) => done(err, user));
  done(null, obj); // For now, just returning the stored GitHub profile
});

// --- GitHub OAuth Strategy Configuration ---
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    // This function is called after a user successfully authenticates with GitHub.
    // 'profile' contains the user's GitHub information (ID, username, etc.).
    // Here, you would typically:
    // 1. Check if the user (profile.id) exists in your application's database.
    // 2. If yes, log them in (return done(null, existingUser)).
    // 3. If no, create a new user record in your database using 'profile' data,
    //    then log them in (return done(null, newUser)).
    console.log(`GitHub Profile: ${profile.username} (ID: ${profile.id})`);
    return done(null, profile); // For demonstration, directly returning GitHub profile
  }
));

// --- Authentication Routes ---

// Route to initiate GitHub login/signup
app.get("/auth/github", passport.authenticate("github", { scope: ["user:email"] }));

// GitHub callback route after user authorizes your app
app.get("/auth/github/callback",
  passport.authenticate("github", {
    failureRedirect: "/login.html", // Redirect to login page on failure
    failureFlash: true // Optional: if you use connect-flash for messages
  }),
  (req, res) => {
    // Successful authentication, redirect to a secure area of your app
    console.log(`GitHub login successful for user: ${req.user.username}`);
    res.redirect("/dashboard.html"); // Redirect to your dashboard page
  }
);

// --- API Routes ---

// API route to get current logged-in user information
// Ensures only authenticated users can access this data
app.get("/api/user", (req, res) => {
  if (req.isAuthenticated()) {
    // `req.user` is populated by Passport after successful authentication
    res.json(req.user);
  } else {
    // Send 401 Unauthorized if not logged in
    res.status(401).json({ error: "Unauthorized: User not logged in." });
  }
});

// Logout route
app.get("/logout", (req, res) => {
  // req.logout() is an asynchronous function
  req.logout((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Error logging out.");
    }
    console.log("User logged out successfully.");
    res.redirect("/login.html"); // Redirect to login page after logout
  });
});

// --- Static File Serving ---
// Serve static files from the 'public' directory
// This will serve your index.html, login.html, signup.html, dashboard.html etc.
app.use(express.static(path.join(__dirname, "public")));

// Catch-all route for any requests that don't match other routes
// This is good for single-page applications where React/Vue/Angular handles routing
// For simple HTML files, this might not be strictly necessary, but it's a good practice
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- Server Start ---
const PORT = process.env.PORT || 3000; // Use port from .env or default to 3000
app.listen(PORT, () => {
  console.log(`✅ Server started at http://localhost:${PORT}`);
  console.log(`Open your browser to http://localhost:${PORT}/login.html`);
});
